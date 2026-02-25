# SPEC-010：Tool Approval SDK Integration（Tool Approval 接通 SDK）

> 追溯規格書——修復已於 commit `a8107c7` 完成。

| 欄位 | 內容 |
|------|------|
| **規格 ID** | SPEC-010 |
| **關聯 ADR** | ADR-019 |
| **估算複雜度** | 中 |
| **建議模型** | Sonnet |
| **HITL 等級** | standard |

---

## 目標（Goal）

> 將既有的 Tool Approval 基礎設施（ToolApprovalStore、WS 廣播、UI ToolApprovalCard）與 Claude Agent SDK runner 實際接通，讓危險操作（Write, Bash 等）在執行前需經使用者確認。

**現況問題：**
- Tool Approval 基礎設施完整（`tool-approval.ts`, `ToolApprovalCard.tsx`, WS `tool_approval_request/response`）
- 但從未與 SDK runner 連接——所有工具都直接執行，跳過審批流程
- `bypassPermissions` 模式下 SDK 不會觸發 `canUseTool` callback

---

## 輸入規格（Inputs）

### 環境變數

| 參數名稱 | 型別 | 預設值 | 限制條件 |
|----------|------|--------|----------|
| `TOOL_APPROVAL_ENABLED` | string → boolean | `false` | `'true'` 或 `'false'` |

### SDK `canUseTool` callback

| 參數名稱 | 型別 | 來源 | 說明 |
|----------|------|------|------|
| toolName | string | SDK | 工具名稱（Read, Write, Bash 等） |
| input | Record<string, unknown> | SDK | 工具輸入參數 |
| toolUseId | string | SDK | 唯一工具使用 ID |

---

## 輸出規格（Expected Output）

### `canUseTool` callback 回傳值

**允許：**
```typescript
{ behavior: 'allow' }
```

**拒絕：**
```typescript
{ behavior: 'deny', message: 'User denied tool execution' }
```

### WS 廣播（`tool_approval_request`）
```json
{
  "type": "tool_approval_request",
  "data": {
    "id": "approval-xxx",
    "toolName": "Bash",
    "input": { "command": "rm -rf /tmp/test" },
    "workspaceId": "ws-xxx",
    "conversationId": "conv-xxx"
  }
}
```

---

## 實作範圍

### 1. Config 新增：`server/src/config.ts`

```typescript
TOOL_APPROVAL_ENABLED: z.string().optional().default('false').transform(v => v === 'true'),
```

### 2. SDK options 擴充：`server/src/ai/claude-sdk.ts`

#### ClaudeSdkOptions interface 新增

```typescript
canUseTool?: (
  toolName: string,
  input: Record<string, unknown>,
  toolUseId: string
) => Promise<
  | { behavior: 'allow'; updatedInput?: Record<string, unknown> }
  | { behavior: 'deny'; message: string }
>;
```

#### `run()` 方法內的邏輯

當 `canUseTool` 存在時：
1. 建立 SDK 相容的 `CanUseTool` wrapper function
2. **移除** `bypassPermissions` 和 `allowDangerouslySkipPermissions`（bypass 模式會跳過 callback）
3. 將 wrapper 傳入 SDK 的 options

### 3. Tool approval handler factory：`server/src/ws/chat-handler.ts`

```typescript
function createToolApprovalHandler(
  workspaceId: string,
  conversationId: string
) {
  return async (toolName: string, input: Record<string, unknown>, toolUseId: string) => {
    // 1. 透過 WS 廣播 tool_approval_request 給所有已認證的 clients
    // 2. 呼叫 toolApprovalStore.requestApproval()（Promise-based, 2min timeout）
    // 3. 若 auto-approve（read-only tools）→ 直接回傳 allow
    // 4. 等待使用者回應或 timeout
    // 5. 將結果映射為 SDK PermissionResult 格式
    return result;
  };
}
```

#### `handleChatMessage()` 中的條件接入

```typescript
const options: RunOptions = { /* ... */ };

if (config.TOOL_APPROVAL_ENABLED) {
  options.canUseTool = createToolApprovalHandler(workspaceId, conversationId);
}
```

#### `sendFeedbackToAI()` 同樣條件接入

### 4. 既有 Tool Approval 基礎設施（不需修改）

以下已存在且正常運作，無需變更：
- `server/src/ws/tool-approval.ts` — `ToolApprovalStore`, `requestApproval()`, `formatToolForDisplay()`
- `client/src/components/chat/ToolApprovalCard.tsx` — UI 審批卡片
- WS 事件：`tool_approval_request`, `tool_approval_response`

---

## 邊界條件（Edge Cases）

- **`TOOL_APPROVAL_ENABLED=false`（預設）**：完全不注入 `canUseTool`，行為與修復前相同（bypassPermissions）
- **Read-only 工具（Read, Glob, Grep）**：`toolApprovalStore` 內建 auto-approve 規則
- **使用者 2 分鐘內未回應**：`requestApproval()` timeout → 自動 deny
- **多裝置連線**：WS 廣播到所有已認證 client，任一裝置可回應
- **Bypass 模式衝突**：當 `canUseTool` 啟用時，必須移除 `bypassPermissions` 才能讓 SDK 觸發 callback
- **Runner abort 期間**：runner abort 會終止整個執行，pending approval 的 Promise 自然 reject

---

## 驗收標準（Done When）

- [x] `TOOL_APPROVAL_ENABLED` 環境變數可控制功能開關
- [x] `canUseTool` callback 正確接入 SDK runner
- [x] 啟用時，`bypassPermissions` 被移除以讓 SDK 觸發 callback
- [x] 危險操作（Write, Bash）觸發 WS 審批請求
- [x] Read-only 工具自動通過
- [x] 2 分鐘 timeout 後自動拒絕
- [x] `TOOL_APPROVAL_ENABLED=false` 時無任何行為改變
- [x] chat handler 和 feedback handler 都有條件接入
- [x] `npm --prefix server run test:run` 全數通過
- [x] `npm --prefix client run test:run` 全數通過

---

## 禁止事項（Out of Scope）

- 不要修改：既有的 `ToolApprovalStore`、`ToolApprovalCard` UI
- 不要實作：Per-tool 細粒度規則配置 UI
- 不要實作：Approval 記錄持久化（目前 in-memory 即可）
- 不要引入新依賴

---

## 參考資料（References）

- 修復 commit：`a8107c7`
- 修改檔案：`server/src/config.ts`, `server/src/ai/claude-sdk.ts`, `server/src/ws/chat-handler.ts`
- 關聯 ADR：ADR-019（Tool Approval 整合方式）
- 既有基礎設施：
  - `server/src/ws/tool-approval.ts` — ToolApprovalStore
  - `client/src/components/chat/ToolApprovalCard.tsx` — 審批 UI
