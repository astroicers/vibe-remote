# SPEC-007：WebSocket Task Status Client Wiring

> 結構完整的規格書讓 AI 零確認直接執行。

| 欄位 | 內容 |
|------|------|
| **規格 ID** | SPEC-007 |
| **關聯 ADR** | ADR-011（In-Memory Task Queue） |
| **估算複雜度** | 低 |
| **建議模型** | Haiku |
| **HITL 等級** | minimal |

---

## 目標（Goal）

> 將 Server 已廣播的 `task_status` WebSocket 事件連接到 Client 的 task store，讓 Tasks 頁面即時反映任務狀態變化（pending → running → completed/failed），無需輪詢。同時在任務完成或失敗時顯示 toast 通知，確保使用者在其他頁面也能感知任務狀態變化。

---

## 輸入規格（Inputs）

| 參數名稱 | 型別 | 來源 | 限制條件 |
|----------|------|------|----------|
| type | `'task_status'` (literal) | WebSocket event `data.type` | 固定值 |
| task | `Task` | WebSocket event `data.task` | 必須包含 `id`、`workspace_id`、`status` |
| timestamp | `string` | WebSocket event `data.timestamp` | ISO 8601 格式（僅供參考，不用於邏輯） |

**Server 端 WS 事件格式（已存在，不需修改）：**

```json
{
  "type": "task_status",
  "task": {
    "id": "task_a1b2c3d4",
    "workspace_id": "ws_xyz",
    "title": "Fix login redirect",
    "status": "running",
    "priority": "normal",
    "progress": null,
    "branch": "task/a1b2c3d4-fix-login-redirect",
    "depends_on": null,
    "dependency_status": "ready",
    "context_files": null,
    "result": null,
    "error": null,
    "created_at": "2026-02-22T10:00:00.000Z",
    "started_at": "2026-02-22T10:01:00.000Z",
    "completed_at": null
  },
  "timestamp": "2026-02-22T10:01:00.123Z"
}
```

---

## 輸出規格（Expected Output）

**即時 UI 更新：**
- Tasks 頁面的 Kanban column 即時反映 task 狀態變化（卡片從一個 column 移動到另一個）
- 新 task（client 端未知的 task ID）自動新增到對應 workspace 的 task 列表最前方
- 已存在的 task 就地更新（保留列表位置）

**Toast 通知：**

| task.status | Toast 類型 | 訊息格式 |
|-------------|-----------|----------|
| `completed` | `success` | `Task completed: {task.title}` |
| `failed` | `error` | `Task failed: {task.title}` |
| 其他狀態 | 不顯示 toast | — |

**無失敗情境** — 此功能為純 client-side 事件監聽，不發送任何請求，不會產生 HTTP 錯誤。若 WS 事件 payload 缺少 `task` 或 `task.workspace_id`，靜默忽略（防禦性 guard）。

---

## 實作範圍

### 1. 新增 `client/src/hooks/useTaskWebSocket.ts`

建立 custom hook，訂閱 `task_status` WebSocket 事件並更新 task store。

```typescript
import { useEffect } from 'react';
import { ws } from '../services/websocket';
import { useTaskStore } from '../stores/tasks';
import { useToastStore } from '../stores/toast';
import type { Task } from '../services/api';

export function useTaskWebSocket(): void {
  useEffect(() => {
    const unsubscribe = ws.on('task_status', (data: Record<string, unknown>) => {
      const task = data.task as Task | undefined;
      if (!task?.id || !task?.workspace_id) return; // defensive guard

      // Update store (upsert)
      useTaskStore.getState().handleTaskStatusUpdate(task);

      // Toast for terminal states
      if (task.status === 'completed') {
        useToastStore.getState().addToast(
          `Task completed: ${task.title}`,
          'success'
        );
      } else if (task.status === 'failed') {
        useToastStore.getState().addToast(
          `Task failed: ${task.title}`,
          'error'
        );
      }
    });

    return unsubscribe;
  }, []);
}
```

**設計決策：**
- 使用獨立 hook 而非在 store 初始化時訂閱（chat store 的模式），原因是 task WS 訂閱需要在 TasksPage mount 時才啟動，且需要 cleanup（chat 是全域常駐，task 頁面可能不被使用）
- Toast 邏輯放在 hook 而非 `handleTaskStatusUpdate` 內，避免 store action 產生 side effect（store 保持純資料操作）
- 使用 `useTaskStore.getState()` 而非 hook 取值，避免不必要的 re-render

### 2. 修改 `client/src/pages/TasksPage.tsx`

在 component 內呼叫 hook。

```diff
 import { useEffect, useState } from 'react';
 import { AppLayout } from '../components/AppLayout';
 import { KanbanColumn } from '../components/tasks/KanbanColumn';
 import { TaskCreateSheet } from '../components/tasks/TaskCreateSheet';
 import { useTaskStore } from '../stores/tasks';
 import { useWorkspaceStore } from '../stores/workspace';
+import { useTaskWebSocket } from '../hooks/useTaskWebSocket';
 import type { Task, CreateTaskData } from '../services/api';

 // ... (icons unchanged)

 export function TasksPage() {
+  useTaskWebSocket();
+
   const [isCreateOpen, setIsCreateOpen] = useState(false);
   // ... rest unchanged
```

只需新增兩行：一行 import、一行 hook 呼叫。

### 3. 不需要修改的檔案（確認清單）

| 檔案 | 原因 |
|------|------|
| `server/src/ws/chat-handler.ts` | `broadcastTaskStatus()` 已正確廣播，無需改動 |
| `server/src/routes/tasks.ts` | `onTaskStatusChange` callback 已正確 wire，無需改動 |
| `server/src/tasks/queue.ts` | `onStatusChange` 在所有狀態變化時觸發，無需改動 |
| `client/src/services/websocket.ts` | `TaskStatusEvent` type 已定義、`on()` API 已就緒，無需改動 |
| `client/src/stores/tasks.ts` | `handleTaskStatusUpdate()` 已實作 upsert 邏輯，無需改動 |
| `client/src/stores/chat.ts` | `diff_ready` 已在此處監聽（line 193），不需要另外處理 |
| `client/src/stores/diff.ts` | `files_changed` 暫不需要 wire — diff store 使用 REST polling（Phase 2 再考慮） |

---

## 邊界條件（Edge Cases）

1. **WS 事件 payload 缺少 `task` 或 `task.workspace_id`**：hook 內的 defensive guard 靜默忽略，不 crash
2. **收到未知 workspace 的 task 更新**：`handleTaskStatusUpdate` 會自動初始化該 workspace 的 task state（`createDefaultWorkspaceTaskState()`），然後插入 task — 這是正確行為
3. **TasksPage 未 mount 時收到事件**：hook 已 cleanup（`unsubscribe()`），事件不會被處理 — task 列表會在下次 mount 時透過 `loadTasks()` 從 REST API 重新載入
4. **同一 task 的多次快速狀態更新**（例如 pending → running → completed）：每次更新都是完整 task 物件替換（非 patch），不會遺失中間狀態
5. **WS 重連後遺失事件**：WS 重連期間的事件會丟失，但 `TasksPage` 的 `useEffect` 在 workspace 切換時會 `loadTasks()` 重新拉取，最終一致性可接受
6. **Toast 堆疊**：toast store 已有 `MAX_TOASTS = 3` 限制，多個 task 同時完成不會溢出

---

## 驗收標準（Done When）

- [x] `npm --prefix client run test:run` 全數通過
- [x] `cd client && npx tsc --noEmit` 無錯誤
- [x] 新增 `client/src/hooks/useTaskWebSocket.ts` 檔案存在且包含 WS 訂閱邏輯
- [x] `TasksPage.tsx` 內呼叫 `useTaskWebSocket()` hook
- [x] 手動測試：透過 API 建立 task 並 run，Tasks 頁面即時從 Pending → Running → Completed/Failed 移動卡片
- [x] 手動測試：task 完成時出現 success toast；失敗時出現 error toast
- [x] 手動測試：離開 Tasks 頁面後再返回，task 列表正確顯示最新狀態
- [x] 新增單元測試：`useTaskWebSocket` hook 測試（驗證 subscribe/unsubscribe lifecycle 和 store 呼叫）

---

## 禁止事項（Out of Scope）

- 不要修改：Server 端的 `broadcastTaskStatus()`、`TaskQueue`、`tasks.ts` route — 這些已正確運作
- 不要修改：`client/src/stores/tasks.ts` 的 `handleTaskStatusUpdate()` — 現有 upsert 邏輯已足夠
- 不要修改：`client/src/services/websocket.ts` — WS service API 已就緒
- 不要實作：`files_changed` WS event 的 client 端 wiring（另開 SPEC 處理）
- 不要實作：push notification 觸發（已有獨立 push 機制）
- 不要在 store 初始化階段訂閱 WS（避免未使用 Tasks 頁面時產生不必要的 store 更新）
- 不要引入新依賴

---

## 參考資料（References）

- 相關 ADR：ADR-011（In-Memory Task Queue）
- 現有 WS 訂閱模式參考：`client/src/stores/chat.ts` lines 106-235（`setupWSHandlers()`）
- Server 端廣播實作：`server/src/ws/chat-handler.ts` lines 79-93（`broadcastTaskStatus()`）
- Server 端 wire：`server/src/routes/tasks.ts` lines 22-25（`taskQueue.onTaskStatusChange()`）
- Client task store handler：`client/src/stores/tasks.ts` lines 162-177（`handleTaskStatusUpdate()`）
- Client WS service API：`client/src/services/websocket.ts` line 127（`on()` method）
- Client WS type 定義：`client/src/services/websocket.ts` lines 194-198（`TaskStatusEvent`）
- Client toast store：`client/src/stores/toast.ts`（`addToast()` API）
