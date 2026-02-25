# SPEC-004：Task Runner WS Streaming

> 結構完整的規格書讓 AI 零確認直接執行。

| 欄位 | 內容 |
|------|------|
| **規格 ID** | SPEC-004 |
| **關聯 ADR** | ADR-011（In-Memory Task Queue） |
| **估算複雜度** | 中 |
| **建議模型** | Sonnet |
| **HITL 等級** | standard |

---

## 目標（Goal）

> 將 Task 執行期間的 AI 進度（文字串流、工具呼叫、完成結果）透過 WebSocket 即時推送到 Client，讓使用者在 TasksPage 可以看到背景任務「AI 正在做什麼」，而非只看到 status 從 running 跳到 completed。

目前 `runner.ts` 建立了 `ClaudeSdkRunner` 但沒有掛載任何 event listener（不像 `chat-handler.ts` 會即時串流 `chat_chunk` / `tool_use`），導致 Task 執行過程完全是黑箱。本 SPEC 補齊這個缺口。

---

## 輸入規格（Inputs）

本功能無新的 HTTP API 輸入。所有新增事件皆為 Server → Client 的 WebSocket 推播。

**觸發條件：**

| 觸發點 | 說明 |
|--------|------|
| TaskQueue `processNext()` 開始執行一個 task | runner 開始產生 streaming events |
| `ClaudeSdkRunner` 的 `event` emitter 發出事件 | 轉譯為 WS 事件推播 |
| runner.run() Promise resolve 或 reject | 發出 `task_complete` 事件 |

---

## 輸出規格（Expected Output）

### 新增 WS 事件類型

以下事件皆為 **broadcast**（發送給所有已認證的 connected clients），與現有 `task_status` 行為一致。

#### 1. `task_progress` — AI 文字串流

```json
{
  "type": "task_progress",
  "taskId": "task_a1b2c3d4",
  "workspaceId": "ws_xyz",
  "text": "我來分析一下這個函式...",
  "timestamp": "2026-02-22T10:00:00.000Z"
}
```

**節流規則：** 每 100ms 最多發出一次。在 100ms 窗口內累積的多個 `text` 事件合併為一個 `task_progress` 發送，避免高頻小封包淹沒 Client。

#### 2. `task_tool_use` — AI 工具呼叫

```json
{
  "type": "task_tool_use",
  "taskId": "task_a1b2c3d4",
  "workspaceId": "ws_xyz",
  "tool": "Edit",
  "input": { "file_path": "/workspace/src/index.ts", "old_string": "...", "new_string": "..." },
  "timestamp": "2026-02-22T10:00:01.000Z"
}
```

**注意：** `input` 中的 `old_string` / `new_string` 若超過 500 字元需截斷（使用 `utils/truncate.ts` 的 `truncateForHistory()`），避免 WS 訊息過大。

#### 3. `task_tool_result` — 工具執行結果

```json
{
  "type": "task_tool_result",
  "taskId": "task_a1b2c3d4",
  "workspaceId": "ws_xyz",
  "tool": "Edit",
  "result": "Successfully edited file",
  "timestamp": "2026-02-22T10:00:02.000Z"
}
```

**注意：** `result` 超過 1000 字元時截斷。

#### 4. `task_complete` — 任務完成（含結果）

```json
{
  "type": "task_complete",
  "taskId": "task_a1b2c3d4",
  "workspaceId": "ws_xyz",
  "status": "completed",
  "result": "Successfully implemented the feature...",
  "modifiedFiles": ["/workspace/src/index.ts", "/workspace/src/utils.ts"],
  "tokenUsage": {
    "inputTokens": 15000,
    "outputTokens": 3000,
    "cacheReadTokens": 5000,
    "cacheCreationTokens": 1000,
    "costUsd": 0.12
  },
  "timestamp": "2026-02-22T10:01:00.000Z"
}
```

失敗時：

```json
{
  "type": "task_complete",
  "taskId": "task_a1b2c3d4",
  "workspaceId": "ws_xyz",
  "status": "failed",
  "error": "Branch already exists: task/a1b2c3d4-fix-login",
  "modifiedFiles": [],
  "timestamp": "2026-02-22T10:01:00.000Z"
}
```

#### 5. 現有 `task_status` — 保持不變

現有的 `task_status` 事件（status 變為 `running` / `completed` / `failed` / `cancelled`）繼續由 `broadcastTaskStatus()` 發送，不受影響。`task_complete` 是額外的補充事件，攜帶 `modifiedFiles` 和 `tokenUsage` 等 `task_status` 沒有的欄位。

---

## 實作範圍

### 1. Server — `shared/types.ts`

在 `WSEventType` union 新增事件類型：

```typescript
export type WSEventType =
  | 'connected'
  | 'ack'
  | 'error'
  | 'chat:message'
  | 'chat:chunk'
  | 'chat:tool_call'
  | 'chat:complete'
  | 'diff:ready'
  | 'diff:updated'
  | 'task:status'
  | 'task:progress'      // 新增
  | 'task:tool_use'      // 新增
  | 'task:tool_result'   // 新增
  | 'task:complete'       // 新增
  | 'workspace:changed'
  | 'notification';
```

> **注意：** `shared/types.ts` 的 `WSEventType` 是「文件性質」的定義。實際 WS 事件 `type` 字串在 server 使用 `task_progress`（底線分隔），與 chat 系列的 `chat_chunk` 風格一致。此處 `task:progress` 對照的實際 wire format 為 `task_progress`。

### 2. Server — `server/src/ws/chat-handler.ts`

新增 `broadcastTaskEvent()` 函式，與既有 `broadcastTaskStatus()` 平行：

```typescript
export function broadcastTaskEvent(event: {
  type: string;
  taskId: string;
  workspaceId: string;
  [key: string]: unknown;
}): void {
  const payload = JSON.stringify({
    ...event,
    timestamp: new Date().toISOString(),
  });

  for (const client of connectedClients) {
    if (client.readyState === client.OPEN && client.isAuthenticated) {
      client.send(payload);
    }
  }
}
```

在 `server/src/ws/index.ts` 導出新函式：

```typescript
export { handleChatWebSocket, broadcastTaskStatus, broadcastTaskEvent } from './chat-handler.js';
```

### 3. Server — `server/src/tasks/runner.ts`

重構 `runTask()` 函式簽名，增加 `onEvent` callback 參數：

```typescript
export type TaskEventCallback = (event: {
  type: string;
  taskId: string;
  workspaceId: string;
  [key: string]: unknown;
}) => void;

export async function runTask(
  task: Task,
  onEvent?: TaskEventCallback
): Promise<{ result?: string; error?: string }> {
```

**在「4. Create runner and execute」區段新增 event listener：**

```typescript
// 4. Create runner and execute
const runner = new ClaudeSdkRunner();

// --- 新增：掛載 event listener ---
let textBuffer = '';
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const THROTTLE_MS = 100;

function flushTextBuffer(): void {
  if (textBuffer && onEvent) {
    onEvent({
      type: 'task_progress',
      taskId: task.id,
      workspaceId: task.workspace_id,
      text: textBuffer,
    });
    textBuffer = '';
  }
  flushTimer = null;
}

if (onEvent) {
  runner.on('event', (event: StreamEvent) => {
    switch (event.type) {
      case 'text':
        // 累積文字，每 100ms flush 一次
        textBuffer += event.content || '';
        if (!flushTimer) {
          flushTimer = setTimeout(flushTextBuffer, THROTTLE_MS);
        }
        break;

      case 'tool_use':
        // 先 flush 暫存的文字
        flushTextBuffer();
        onEvent({
          type: 'task_tool_use',
          taskId: task.id,
          workspaceId: task.workspace_id,
          tool: event.toolName,
          input: event.toolInput,
        });
        break;

      case 'tool_result':
        onEvent({
          type: 'task_tool_result',
          taskId: task.id,
          workspaceId: task.workspace_id,
          tool: event.toolName,
          result: event.toolResult,
        });
        break;

      case 'error':
        flushTextBuffer();
        // error 不在這裡處理，由 run() 的 catch 統一處理
        break;

      case 'done':
        // 確保最後的文字送出
        flushTextBuffer();
        break;
    }
  });
}
```

**在 runner.run() 完成後發出 `task_complete`：**

```typescript
try {
  const response = await runner.run(prompt, { ... });

  // 確保最後的 text buffer flush
  flushTextBuffer();

  // 發出 task_complete 事件
  onEvent?.({
    type: 'task_complete',
    taskId: task.id,
    workspaceId: task.workspace_id,
    status: 'completed',
    result: response.fullText || 'Task completed successfully',
    modifiedFiles: response.modifiedFiles,
    tokenUsage: response.tokenUsage,
  });

  return { result: response.fullText || 'Task completed successfully' };
} catch (error) {
  flushTextBuffer();

  const errorMessage = error instanceof Error ? error.message : 'Unknown error during task execution';

  onEvent?.({
    type: 'task_complete',
    taskId: task.id,
    workspaceId: task.workspace_id,
    status: 'failed',
    error: errorMessage,
    modifiedFiles: [],
  });

  return { error: errorMessage };
}
```

### 4. Server — `server/src/tasks/queue.ts`

修改 `TaskRunnerFn` type 和 `TaskQueue` 以支援 event callback 傳遞。

**擴展 runner function 簽名：**

```typescript
type TaskRunnerFn = (
  task: Task,
  onEvent?: (event: { type: string; taskId: string; workspaceId: string; [key: string]: unknown }) => void
) => Promise<{ result?: string; error?: string }>;
```

**新增 `onTaskEvent` callback：**

```typescript
export class TaskQueue {
  // ... 既有欄位 ...
  private onTaskEvent: ((event: { type: string; taskId: string; workspaceId: string; [key: string]: unknown }) => void) | null = null;

  // 新增方法
  onTaskEventCallback(
    callback: (event: { type: string; taskId: string; workspaceId: string; [key: string]: unknown }) => void
  ): void {
    this.onTaskEvent = callback;
  }
```

**在 `processNext()` 中傳遞 event callback 給 runner：**

```typescript
// 修改既有 runner 呼叫
const result = await this.runner(next, this.onTaskEvent ?? undefined);
```

### 5. Server — `server/src/routes/tasks.ts`

註冊 task event callback，將事件轉發到 WS broadcast：

```typescript
import { broadcastTaskStatus, broadcastTaskEvent } from '../ws/index.js';

// ... 既有的 onTaskStatusChange 之後 ...

// Broadcast task streaming events via WebSocket
taskQueue.onTaskEventCallback((event) => {
  broadcastTaskEvent(event);
});
```

### 6. Client — `client/src/services/websocket.ts`

新增事件類型定義（僅型別，不需修改邏輯；`ws.on('task_progress', handler)` 已可使用）：

```typescript
// Task streaming event types
export interface TaskProgressEvent {
  type: 'task_progress';
  taskId: string;
  workspaceId: string;
  text: string;
  timestamp: string;
}

export interface TaskToolUseEvent {
  type: 'task_tool_use';
  taskId: string;
  workspaceId: string;
  tool: string;
  input: Record<string, unknown>;
  timestamp: string;
}

export interface TaskToolResultEvent {
  type: 'task_tool_result';
  taskId: string;
  workspaceId: string;
  tool: string;
  result: unknown;
  timestamp: string;
}

export interface TaskCompleteEvent {
  type: 'task_complete';
  taskId: string;
  workspaceId: string;
  status: 'completed' | 'failed';
  result?: string;
  error?: string;
  modifiedFiles: string[];
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
    costUsd: number;
  };
  timestamp: string;
}
```

### 7. Client — `client/src/stores/tasks.ts`

新增 task progress 狀態追蹤，用於 UI 顯示：

```typescript
interface WorkspaceTaskState {
  tasks: Task[];
  // 新增：正在執行的 task 的即時進度
  activeTaskProgress: Record<string, TaskProgress>;
}

interface TaskProgress {
  taskId: string;
  chunks: string[];        // 累積的文字片段（保留最近 50 條）
  currentText: string;     // 最近一次收到的文字
  lastToolUse: { tool: string; input: unknown } | null;
  lastToolResult: { tool: string; result: unknown } | null;
}
```

新增 handler 方法：

```typescript
handleTaskProgress: (taskId: string, workspaceId: string, text: string) => void;
handleTaskToolUse: (taskId: string, workspaceId: string, tool: string, input: unknown) => void;
handleTaskToolResult: (taskId: string, workspaceId: string, tool: string, result: unknown) => void;
handleTaskComplete: (taskId: string, workspaceId: string, status: string, result?: string, error?: string, modifiedFiles?: string[]) => void;
```

**`handleTaskProgress` 實作重點：**
- `chunks` 陣列保留最近 50 條，超過時移除最舊的
- 用於 TaskCard 展開後顯示即時文字串流

**`handleTaskComplete` 實作重點：**
- 清除 `activeTaskProgress[taskId]`
- 更新 `tasks` 陣列中對應 task 的 status / result / error

### 8. Client — WS 事件接線

在 App 層級（`App.tsx` 或新建 `hooks/useTaskEvents.ts`）訂閱 WS 事件，呼叫 store handler：

```typescript
useEffect(() => {
  const unsubs = [
    ws.on('task_status', (data) => {
      const event = data as TaskStatusEvent;
      useTaskStore.getState().handleTaskStatusUpdate(event.task as Task);
    }),
    ws.on('task_progress', (data) => {
      const event = data as TaskProgressEvent;
      useTaskStore.getState().handleTaskProgress(event.taskId, event.workspaceId, event.text);
    }),
    ws.on('task_tool_use', (data) => {
      const event = data as TaskToolUseEvent;
      useTaskStore.getState().handleTaskToolUse(event.taskId, event.workspaceId, event.tool, event.input);
    }),
    ws.on('task_tool_result', (data) => {
      const event = data as TaskToolResultEvent;
      useTaskStore.getState().handleTaskToolResult(event.taskId, event.workspaceId, event.tool, event.result);
    }),
    ws.on('task_complete', (data) => {
      const event = data as TaskCompleteEvent;
      useTaskStore.getState().handleTaskComplete(
        event.taskId, event.workspaceId, event.status,
        event.result, event.error, event.modifiedFiles
      );
    }),
  ];
  return () => unsubs.forEach(fn => fn());
}, []);
```

---

## 邊界條件（Edge Cases）

- **Task 執行中 WS 斷線重連：** Client 重連後不會收到歷史 streaming 事件（不做回補）。`task_status` 事件會在重連後的下次狀態變更時送出，Client 可從 REST API `GET /tasks/:id` 取得最終結果。
- **task_progress 高頻文字：** 透過 100ms 節流機制合併，確保每秒最多 10 次推送。若 AI 大量輸出，單次合併後的 `text` 可能較長，但比逐字元推送節省頻寬。
- **Task 被 cancel 時 runner 仍在執行：** 現有 `queue.ts` 的 cancel 機制僅標記 status，runner 繼續執行直到自然結束。event listener 會繼續發送事件，但 `task_complete` 不會被發出（因為 `processNext()` 中 cancel 檢查在 runner result 處理之前）。Client 收到 `task_status: cancelled` 後應忽略後續同 taskId 的 progress 事件。
- **多個 Client 同時觀看：** 所有事件 broadcast 給全部已認證 client，不做 per-client 過濾。Client 自行根據 `workspaceId` 和 `taskId` 過濾。
- **runner.run() 拋出非 Error 物件：** 已有 `error instanceof Error ? error.message : 'Unknown error'` 防護。
- **Timer 未清除：** `flushTimer` 使用 `setTimeout`，在 runner.run() 結束後（無論成功或失敗）都會呼叫 `flushTextBuffer()` 清除。若 process 意外中斷，timer 自然被 GC。
- **tool_use 的 input 含敏感資訊（如 file content）：** 使用 `truncateForHistory()` 截斷大型 input，避免 WS 訊息超過合理大小。Bash 指令的 `command` 欄位不截斷（通常較短），但 Write/Edit 的 `content`/`new_string` 截斷至 500 字元。
- **onEvent callback 為 undefined（向後相容）：** `runTask()` 的 `onEvent` 參數為可選。不傳入時行為與修改前完全一致——runner 不掛載 event listener，不發送任何 WS 事件。

---

## 驗收標準（Done When）

- [x] `npm --prefix server run test:run` 全數通過（含新增 streaming 相關測試）
- [x] `npm --prefix client run test:run` 全數通過
- [x] `cd server && npx tsc --noEmit` 無錯誤
- [x] `cd client && npx tsc --noEmit` 無錯誤
- [x] Task 執行期間，WS Client 收到 `task_progress` 事件，包含 AI 文字串流
- [x] Task 執行期間，AI 呼叫工具時 Client 收到 `task_tool_use` 和 `task_tool_result` 事件
- [x] Task 完成時 Client 收到 `task_complete` 事件，包含 `modifiedFiles` 和 `tokenUsage`
- [x] Task 失敗時 Client 收到 `task_complete` 事件，`status: 'failed'` 且包含 `error`
- [x] `task_progress` 文字串流有 100ms 節流（同一 task 不會每毫秒發送一次）
- [x] 既有 `task_status` 事件不受影響，繼續正常運作
- [x] `runTask()` 不傳 `onEvent` 時行為與修改前一致（向後相容）
- [x] Client `useTaskStore` 有 `handleTaskProgress` / `handleTaskComplete` 方法
- [x] Client App 層級有 WS 事件訂閱，呼叫 store handler

---

## 禁止事項（Out of Scope）

- 不要實作：Task streaming 的歷史回補（reconnect 後從頭重播）— 用 REST API 查詢最終結果即可
- 不要實作：TaskCard 的即時 streaming UI（本 SPEC 只處理 data layer；UI 展示屬 UI SPEC）
- 不要實作：Per-client 事件過濾（如只發給「正在觀看此 task 的 client」）— broadcast 全部 client，client 自行過濾
- 不要修改：`ClaudeSdkRunner` 類別本身 — 只修改 `runner.ts` 中消費 event 的方式
- 不要修改：DB schema — 不需要新增欄位
- 不要引入新依賴：使用 Node.js 內建 `setTimeout` 做節流，不引入 lodash/throttle
- 不要修改：既有 `broadcastTaskStatus()` 函式的行為或簽名

---

## 參考資料（References）

- 相關 ADR：ADR-011（In-Memory Task Queue）
- 現有實作（參考模式）：
  - `server/src/ws/chat-handler.ts` lines 480-530 — chat streaming 的 `runner.on('event', ...)` 參考實作
  - `server/src/ws/chat-handler.ts` lines 80-93 — `broadcastTaskStatus()` broadcast 模式
  - `server/src/ai/claude-sdk.ts` — `ClaudeSdkRunner` 的 `StreamEvent` 定義及 event emitter 行為
- 需修改檔案清單：
  - `shared/types.ts` — WSEventType 新增 4 個值
  - `server/src/tasks/runner.ts` — 掛載 event listener + onEvent callback
  - `server/src/tasks/queue.ts` — 擴展 TaskRunnerFn type + onTaskEvent callback
  - `server/src/ws/chat-handler.ts` — 新增 `broadcastTaskEvent()`
  - `server/src/ws/index.ts` — 導出 `broadcastTaskEvent`
  - `server/src/routes/tasks.ts` — 註冊 onTaskEvent callback
  - `client/src/services/websocket.ts` — 新增事件型別定義
  - `client/src/stores/tasks.ts` — 新增 progress state + handler 方法
  - `client/src/App.tsx`（或新建 `hooks/useTaskEvents.ts`）— WS 事件訂閱接線
