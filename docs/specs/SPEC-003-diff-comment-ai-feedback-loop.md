# SPEC-003：Diff Comment AI Feedback Loop

> 結構完整的規格書讓 AI 零確認直接執行。

| 欄位 | 內容 |
|------|------|
| **規格 ID** | SPEC-003 |
| **關聯 ADR** | ADR-013（Diff Review） |
| **估算複雜度** | 中 |
| **建議模型** | Sonnet |
| **HITL 等級** | standard |

---

## 目標（Goal）

> 當使用者在 Diff Review 頁面 reject 檔案並留下 comment 後，系統自動將 feedback 送回原 AI conversation，AI 修正完畢後自動產生新的 diff review，使用者在 DiffPage 直接看到更新結果——實現「reject with comments → AI fix → new diff review」的閉環，無需手動建立新 conversation 或切換到 ChatPage。

---

## 輸入規格（Inputs）

| 參數名稱 | 型別 | 來源 | 限制條件 |
|----------|------|------|----------|
| reviewId | string | URL path param `/api/diff/reviews/:id/feedback` | 必須存在且為 `diff_reviews` 中有效 ID |
| filePathFilter | string[] \| undefined | HTTP Body（可選） | 若提供，僅送出指定檔案的 comment；若不提供，送出所有 user comment |

**API Endpoint：**

```
POST /api/diff/reviews/:id/feedback
Content-Type: application/json
Authorization: Bearer <token>

{
  "filePathFilter": ["src/foo.ts"]   // 可選：僅送出特定檔案的 feedback
}
```

---

## 輸出規格（Expected Output）

**成功情境（同步回應）：**
```json
{
  "status": "processing",
  "conversationId": "conv_abc123",
  "message": "Feedback sent to AI. A new diff review will be created when processing completes."
}
```

API 立即回傳 `202 Accepted`，AI 處理在背景進行。處理完畢後透過 WebSocket 推送事件。

**WebSocket 事件流程：**

1. 送出 feedback 後，server 先廣播 `feedback_processing` 事件：
```json
{
  "type": "feedback_processing",
  "workspaceId": "ws_xxx",
  "conversationId": "conv_abc123",
  "originalReviewId": "diff_yyy"
}
```

2. AI 處理期間，照常推送 `chat_chunk`、`tool_use`、`tool_result` 事件（workspaceId + conversationId 指向原 conversation）

3. AI 完成且有檔案變更時，server 自動建立 diff review 並廣播 `diff_ready` 事件：
```json
{
  "type": "diff_ready",
  "workspaceId": "ws_xxx",
  "conversationId": "conv_abc123",
  "reviewId": "diff_zzz",
  "files": ["src/foo.ts", "src/bar.ts"],
  "isFeedbackResult": true,
  "originalReviewId": "diff_yyy"
}
```

4. 若 AI 完成但無檔案變更：
```json
{
  "type": "feedback_complete",
  "workspaceId": "ws_xxx",
  "conversationId": "conv_abc123",
  "originalReviewId": "diff_yyy",
  "message": "AI processed feedback but made no file changes."
}
```

**失敗情境：**

| 錯誤類型 | HTTP Code | 處理方式 |
|----------|-----------|----------|
| review 不存在 | 404 | `{ error: "Diff review not found", code: "NOT_FOUND" }` |
| review 沒有 user comment | 400 | `{ error: "No user comments to send as feedback", code: "NO_COMMENTS" }` |
| workspace 不存在 | 404 | `{ error: "Workspace not found", code: "WORKSPACE_NOT_FOUND" }` |
| AI runner 已在執行（同 conversation） | 409 | `{ error: "Conversation is already processing", code: "RUNNER_BUSY" }` |
| 全域 runner 數達上限 | 429 | `{ error: "Too many concurrent sessions", code: "RATE_LIMIT" }` |

---

## 實作範圍

### 1. Server — `server/src/routes/diff.ts`

新增 `POST /reviews/:id/feedback` endpoint：

```typescript
const feedbackSchema = z.object({
  filePathFilter: z.array(z.string()).optional(),
});

router.post('/reviews/:id/feedback', async (req, res) => {
  // 1. 驗證 review 存在
  // 2. 取得 review 的 user comments（依 filePathFilter 過濾）
  // 3. 驗證至少有一則 user comment
  // 4. 取得 workspace
  // 5. 取得或建立 conversationId：
  //    - 若 review.conversationId 不為空 → 使用原 conversation
  //    - 若為空 → 建立新 conversation（INSERT INTO conversations）
  // 6. 檢查 runner 並行限制（activeRunners map）
  // 7. 組裝 feedback prompt（見下方格式）
  // 8. 回傳 202 Accepted
  // 9. 背景啟動 AI runner（呼叫 sendFeedbackToAI()）
});
```

**Feedback Prompt 格式：**

```
I received review feedback on my previous changes. Please fix the following issues:

## Rejected Files with Comments

### src/components/Foo.tsx
- Line 42: Variable name is confusing, rename to `userCount` (line 42)
- The error handling in this file is incomplete

### src/utils/bar.ts
- Line 15: This function should handle null input (line 15)

## Instructions
- Read each file mentioned above
- Apply the requested fixes based on the review comments
- Do NOT modify files that were not mentioned in the feedback
- After making changes, briefly summarize what you fixed
```

### 2. Server — `server/src/ws/chat-handler.ts`

新增 exported helper function `sendFeedbackToAI()`，供 diff route 呼叫：

```typescript
export async function sendFeedbackToAI(params: {
  workspaceId: string;
  conversationId: string;
  prompt: string;
  originalReviewId: string;
  model?: string;
}): Promise<void>
```

實作邏輯：
- 從 `connectedClients` 取得 authenticated WS connections 進行廣播
- 建立 `ClaudeSdkRunner`，註冊到 `activeRunners` map
- 對所有 connected clients 廣播 `feedback_processing` 事件
- 儲存 user message（`saveMessage(conversationId, 'user', prompt)`）
- 執行 `runner.run()` 並監聽事件，廣播 `chat_chunk` / `tool_use` / `tool_result` 給所有 clients
- 完成後：
  - 儲存 assistant message
  - 若 `response.modifiedFiles.length > 0`：
    - 呼叫 `createDiffReview(workspaceId, workspacePath, conversationId)` 建立新 review
    - 廣播增強版 `diff_ready` 事件（含 `reviewId`、`isFeedbackResult: true`、`originalReviewId`）
  - 若無檔案變更：
    - 廣播 `feedback_complete` 事件
- 清理 runner（`finally` block 中 delete from `activeRunners`）

**注意：** `sendFeedbackToAI()` 廣播給所有 authenticated clients（非特定 WebSocket），因為 REST endpoint 沒有持有 WS reference。使用已有的 `connectedClients` Set 遍歷廣播。

### 3. Server — `server/src/diff/manager.ts`

不需修改核心邏輯。`createDiffReview()` 已接受 `conversationId` 參數，可直接復用。

新增 helper（可選但推薦）：

```typescript
/**
 * 取得 review 中指定檔案路徑的 user comments，組成 feedback 文字
 */
export function buildFeedbackPrompt(
  review: DiffReview,
  filePathFilter?: string[]
): string
```

### 4. Client — `client/src/services/api.ts`

在 `diff` object 新增方法：

```typescript
sendFeedback: (id: string, filePathFilter?: string[]) =>
  request<{ status: string; conversationId: string; message: string }>(
    `/diff/reviews/${id}/feedback`,
    {
      method: 'POST',
      json: { filePathFilter },
    }
  ),
```

### 5. Client — `client/src/stores/diff.ts`

新增狀態欄位與 action：

```typescript
interface WorkspaceDiffState {
  // ...existing fields...
  feedbackProcessing: boolean;         // 新增：AI 是否正在處理 feedback
  feedbackOriginalReviewId: string | null;  // 新增：正在處理 feedback 的原 review ID
}

// 新增 action：
sendFeedback: (workspaceId: string, filePathFilter?: string[]) => Promise<void>;
onFeedbackDiffReady: (workspaceId: string, reviewId: string) => void;
```

`sendFeedback()` 實作：
1. 設定 `feedbackProcessing = true`
2. 呼叫 `diff.sendFeedback(currentReview.id, filePathFilter)`
3. 等待 WS `diff_ready`（isFeedbackResult=true）事件觸發 `onFeedbackDiffReady()`

`onFeedbackDiffReady()` 實作：
1. 設定 `feedbackProcessing = false`
2. 呼叫 `loadReview(workspaceId, reviewId)` 載入新 review

### 6. Client — `client/src/pages/DiffPage.tsx`

修改 `handleSendFeedbackToAI()`：

```typescript
const handleSendFeedbackToAI = async () => {
  if (!wsId) return;
  try {
    await sendFeedback(wsId);
    // 不再 navigate('/chat')
    // feedbackProcessing state 會顯示 loading indicator
  } catch (error) {
    // error 由 store 處理並顯示 toast
  }
  setShowFeedbackPrompt(false);
};
```

新增 WS 事件監聽（useEffect）：

```typescript
useEffect(() => {
  const unsubDiffReady = ws.on('diff_ready', (data) => {
    if (data.isFeedbackResult && data.workspaceId === wsId) {
      onFeedbackDiffReady(wsId, data.reviewId as string);
      // 更新 URL 到新 review
      navigate(`/diff?review=${data.reviewId}`, { replace: true });
    }
  });

  const unsubComplete = ws.on('feedback_complete', (data) => {
    if (data.workspaceId === wsId) {
      // AI 完成但無檔案變更
      useToastStore.getState().addToast(
        'AI processed feedback but made no changes',
        'info'
      );
      // Reset processing state
      onFeedbackDiffReady(wsId, '');
    }
  });

  return () => { unsubDiffReady(); unsubComplete(); };
}, [wsId]);
```

新增 feedback processing 狀態 UI：
- 在 bottom actions 區域，當 `feedbackProcessing === true` 時顯示 loading spinner + "AI is processing your feedback..." 文字
- 禁用所有 review actions（approve/reject buttons）

### 7. Client — `client/src/components/diff/DiffCommentList.tsx`

修改 `handleSendToAI()`：

```typescript
const handleSendToAI = async () => {
  if (!selectedWorkspaceId) return;
  // 改用 diff store 的 sendFeedback，帶 filePathFilter
  const { sendFeedback, getDiffState } = useDiffStore.getState();
  const review = getDiffState(selectedWorkspaceId).currentReview;
  if (!review) return;

  try {
    await sendFeedback(selectedWorkspaceId, [filePath]);
  } catch {
    // error handled by store
  }
};
```

移除 `useChatStore` import 和 `useNavigate` import（不再需要手動建立 conversation 或導航到 chat）。

### 8. Shared — `shared/types.ts`

在 `WSEventType` union 新增：

```typescript
export type WSEventType =
  | // ...existing types...
  | 'feedback:processing'
  | 'feedback:complete';
```

---

## 邊界條件（Edge Cases）

- **Review 無 conversationId（null）：** review 可能由 `POST /diff/reviews` 建立時未指定 conversationId。此時 `sendFeedback` 應建立一個新 conversation（workspace_id 從 review 取得），並更新 `diff_reviews.conversation_id`。
- **同一 conversation 已有 runner 在執行：** 回傳 409 `RUNNER_BUSY`，client 顯示 toast 提示「AI is busy, please wait」。
- **全域 runner 達上限（MAX_CONCURRENT_RUNNERS=3）：** 回傳 429，client 顯示 toast。
- **AI 處理期間 WebSocket 斷線：** AI 仍在 server 端繼續執行；client 重連後需輪詢 review 狀態（或透過 `loadReviews()` 刷新）。`feedbackProcessing` state 在重連後需要同步——可在 WS reconnect 時呼叫 `loadReviews(wsId)` 檢查是否有新 review。
- **Review 已被 approved 後仍送 feedback：** 不限制——即使 review status 非 pending 也允許送 feedback（使用者可能 approve 部分檔案、reject 部分檔案並附 comment）。
- **filePathFilter 指定的路徑無 comment：** 過濾後若 comments 為空，回傳 400 `NO_COMMENTS`。
- **AI 修改了 review 外的檔案：** 新 diff review 會包含所有 unstaged changes（`getGitDiff` 的行為），不限於原 review 中的檔案。這是預期行為——AI 可能需要修改相關檔案。
- **短時間內多次送 feedback（同一 review）：** 因為 runner per-conversation lock，第二次會被 409 擋住。
- **原 review 已被 reject（files discarded）：** 如果 `rejectAll()` 已執行 `discardChanges()`，工作目錄已回到 clean 狀態。此時 AI 會基於 clean 狀態重新撰寫程式碼。feedback prompt 應明確告知 AI「之前的變更已被丟棄，請重新實作以下需求」。
  - **偵測方式：** 檢查 `review.status === 'rejected'`，若是，在 prompt 前加上：`"Note: The previous changes were discarded. Please re-implement the changes addressing the following feedback:"`

---

## 驗收標準（Done When）

- [x] `npm --prefix server run test:run` 全數通過（含新增 feedback endpoint 測試）
- [x] `npm --prefix client run test:run` 全數通過
- [x] `cd server && npx tsc --noEmit` 無錯誤
- [x] `cd client && npx tsc --noEmit` 無錯誤
- [x] `POST /api/diff/reviews/:id/feedback` 回傳 202 並開始背景 AI 處理
- [x] AI 處理期間 WS 廣播 `feedback_processing` + streaming 事件
- [x] AI 完成且有檔案變更時自動建立新 diff review
- [x] Client 收到 `diff_ready`（isFeedbackResult=true）後自動載入新 review，URL 更新
- [x] DiffPage 顯示 feedback processing loading 狀態
- [x] DiffCommentList 的「Send feedback to AI」按鈕改用新 API（不再建立新 conversation、不再導航到 ChatPage）
- [x] DiffPage 的「Reject All → Send Feedback to AI?」dialog 改用新 API
- [x] Review 無 conversationId 時能自動建立 conversation 並正確關聯
- [x] Runner busy / rate limit 情境正確回傳 409/429 並在 client 顯示 toast
- [x] Review 已 rejected（files discarded）時 prompt 包含重新實作指示

---

## 禁止事項（Out of Scope）

- 不要實作：AI comment 自動回寫到 diff_comments 表（AI 的回覆存在 conversation messages 中即可，未來可擴展）
- 不要實作：多輪 feedback loop 自動化（第一輪 feedback → AI fix → new review，若使用者再次 reject 則手動再點一次 send feedback）
- 不要實作：per-line AI 修正建議（逐行 AI 建議功能為獨立 feature）
- 不要修改：DB schema（`diff_reviews` 和 `diff_comments` 表結構不變）
- 不要修改：`ClaudeSdkRunner` 核心邏輯（復用現有的 `run()` 方法）
- 不要引入新依賴：使用現有的 zod、express-ws、zustand 即可

---

## 參考資料（References）

- 相關 ADR：ADR-013（Diff Review）
- 現有實作：
  - `server/src/diff/manager.ts` — `createDiffReview()`, `getDiffReview()`, `addDiffComment()`
  - `server/src/routes/diff.ts` — 現有 diff REST endpoints（359 行）
  - `server/src/ws/chat-handler.ts` — `handleChatMessage()`, `activeRunners` Map, `connectedClients` Set, `broadcastTaskStatus()`
  - `server/src/ai/claude-sdk.ts` — `ClaudeSdkRunner.run()`, `ChatResponse.modifiedFiles`
  - `client/src/pages/DiffPage.tsx` — `handleSendFeedbackToAI()`, `handleRejectAll()`
  - `client/src/components/diff/DiffCommentList.tsx` — per-file「Send feedback to AI」按鈕
  - `client/src/stores/diff.ts` — per-workspace partitioned state
  - `client/src/services/api.ts` — `diff` API client namespace
  - `client/src/services/websocket.ts` — `ws.on()` event subscription pattern
- DB Schema：
  - `diff_reviews`：`id, conversation_id, workspace_id, status, files_json, created_at, updated_at`
  - `diff_comments`：`id, diff_review_id, file_path, line_number, content, author (user|ai), created_at`
  - `conversations`：`id, workspace_id, title, sdk_session_id, token_usage, created_at, updated_at`
