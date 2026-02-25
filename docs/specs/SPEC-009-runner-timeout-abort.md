# SPEC-009：Runner Timeout + Abort（Runner 超時與中止機制）

> 追溯規格書——修復已於 commit `4bf6dc2` 完成。

| 欄位 | 內容 |
|------|------|
| **規格 ID** | SPEC-009 |
| **關聯 ADR** | ADR-018 |
| **估算複雜度** | 中 |
| **建議模型** | Sonnet |
| **HITL 等級** | standard |

---

## 目標（Goal）

> 為 AI runner 加入超時機制和手動中止能力，防止 runner 無限期執行卡住 conversation，並讓使用者能主動中止卡住的 AI 處理。

**現況問題：**
- `runner.run()` 無 timeout，若 Claude CLI 卡住（如等待 interactive input），runner 會永久鎖定
- 被鎖定的 conversation 無法再發送新訊息（Map key 檢查阻擋）
- 無手動中止 UI——使用者只能等待或重啟 server

---

## 輸入規格（Inputs）

### 環境變數

| 參數名稱 | 型別 | 預設值 | 限制條件 |
|----------|------|--------|----------|
| `RUNNER_TIMEOUT_MS` | string → number | `600000` (10min) | > 0 |

### REST API：POST /api/chat/conversations/:id/abort

| 參數名稱 | 型別 | 來源 | 限制條件 |
|----------|------|------|----------|
| id | string | URL param | 有效的 conversation ID |

需要認證（`authMiddleware`）。

---

## 輸出規格（Expected Output）

### POST /api/chat/conversations/:id/abort — 成功
```json
{
  "success": true,
  "message": "Runner aborted"
}
```

### 失敗情境

| 錯誤類型 | HTTP Code | 回傳格式 |
|----------|-----------|----------|
| Conversation 不存在 | 404 | `{ error: "Conversation not found", code: "NOT_FOUND" }` |
| 該 conversation 無 active runner | 404 | `{ error: "No active runner for this conversation", code: "RUNNER_NOT_FOUND" }` |

### 超時行為
- Runner 超過 `RUNNER_TIMEOUT_MS` 後自動 abort
- WS 廣播 `chat_error` 事件：`{ error: "Operation timed out after Xs" }`
- Runner 從 `activeRunners` Map 中移除

---

## 實作範圍

### 1. 通用 timeout 工具：`server/src/utils/timeout.ts`（新建）

```typescript
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  onTimeout: () => void
): Promise<T>
```

- 使用 `Promise` + `setTimeout` 實作 race
- Timeout 時先呼叫 `onTimeout()` callback，再 reject with Error
- Promise resolve/reject 時 `clearTimeout` 避免記憶體洩漏

### 2. Config 新增：`server/src/config.ts`

```typescript
RUNNER_TIMEOUT_MS: z.string().optional().default('600000').transform(Number),  // 10 minutes
```

### 3. Chat handler 改造：`server/src/ws/chat-handler.ts`

#### RunnerState 新增欄位
```typescript
interface RunnerState {
  runner: ClaudeSdkRunner;
  ws: Set<WebSocket>;
  createdAt: number;  // 新增：用於 stale 檢測
}
```

#### `abortRunner()` 匯出函式
```typescript
export function abortRunner(workspaceId: string, conversationId: string): boolean
```
- 從 `activeRunners` 查找對應 runner
- 呼叫 `runner.abort()` + 從 Map 移除
- 回傳是否成功 abort

#### 定期 stale runner 清理
```typescript
setInterval(() => {
  const now = Date.now();
  for (const [key, state] of activeRunners.entries()) {
    if (now - state.createdAt > config.RUNNER_TIMEOUT_MS * 1.5) {
      state.runner.abort();
      activeRunners.delete(key);
    }
  }
}, 60_000);
```

#### `handleChatMessage()` 中包裹 timeout
```typescript
await withTimeout(
  runner.run(message, { /* options */ }),
  config.RUNNER_TIMEOUT_MS,
  () => { runner.abort(); activeRunners.delete(runnerKey); }
);
```

#### `sendFeedbackToAI()` 同樣包裹 timeout

### 4. WS module export：`server/src/ws/index.ts`

新增 `abortRunner` 到 export 列表。

### 5. Task runner 包裹 timeout：`server/src/tasks/runner.ts`

```typescript
await withTimeout(
  runner.run(prompt, options),
  config.RUNNER_TIMEOUT_MS,
  () => {
    runner.abort();
    // emit task_complete with status: 'failed'
  }
);
```

### 6. Abort API endpoint：`server/src/routes/chat.ts`

```typescript
router.post('/conversations/:id/abort', (req, res) => {
  // 1. 查找 conversation 的 workspace_id
  // 2. 呼叫 abortRunner(workspace_id, conversationId)
  // 3. 回傳結果
});
```

### 7. Client API：`client/src/services/api.ts`

```typescript
abortConversation: (id: string) =>
  request<{ success: boolean; message: string }>(
    `/chat/conversations/${id}/abort`,
    { method: 'POST' }
  ),
```

### 8. Abort UI 按鈕：`client/src/pages/ChatPage.tsx`

- 在 header 區域顯示紅色 abort 按鈕（X 圖示）
- 僅在 `isStreaming || isSending` 時顯示
- 點擊後呼叫 `chatApi.abortConversation(currentConversationId)`
- 成功時顯示 toast「AI processing aborted」

---

## 邊界條件（Edge Cases）

- **Runner 在 timeout 前正常完成**：`clearTimeout` 取消 timer，無副作用
- **Abort 已經完成的 runner**：`abortRunner()` 回傳 false，API 回 404
- **Stale cleanup 與 withTimeout race**：兩者都安全——abort 已經被移除的 runner 是 no-op
- **Task runner timeout**：emit `task_complete` with `status: 'failed'`，task 狀態正確更新
- **WS 斷線後 abort**：REST endpoint 不依賴 WS 連線，可獨立操作

---

## 驗收標準（Done When）

- [x] `RUNNER_TIMEOUT_MS` 可透過環境變數設定
- [x] `withTimeout()` 工具正確實作 Promise race
- [x] Runner 超時後自動 abort + 從 Map 移除
- [x] Stale runner 定期清理（60s interval, 1.5x threshold）
- [x] `POST /api/chat/conversations/:id/abort` 正常運作
- [x] Client abort 按鈕在 streaming 時顯示、點擊後中止
- [x] Task runner 也有 timeout 保護
- [x] `npm --prefix server run test:run` 全數通過
- [x] `npm --prefix client run test:run` 全數通過

---

## 禁止事項（Out of Scope）

- 不要修改：Claude Agent SDK 的 abort 機制（使用現有 `runner.abort()`）
- 不要實作：Graceful shutdown（runner abort 是 hard stop）
- 不要實作：Client 端自動重試（abort 後使用者手動重送）
- 不要引入新依賴

---

## 參考資料（References）

- 修復 commit：`4bf6dc2`
- 修改檔案：`server/src/config.ts`, `server/src/utils/timeout.ts`（新建）, `server/src/ws/chat-handler.ts`, `server/src/ws/index.ts`, `server/src/tasks/runner.ts`, `server/src/routes/chat.ts`, `client/src/services/api.ts`, `client/src/pages/ChatPage.tsx`
- 關聯 ADR：ADR-018（Runner 超時設計）
