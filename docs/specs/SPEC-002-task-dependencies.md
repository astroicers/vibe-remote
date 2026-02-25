# SPEC-002：Task Dependencies

> 結構完整的規格書讓 AI 零確認直接執行。

| 欄位 | 內容 |
|------|------|
| **規格 ID** | SPEC-002 |
| **關聯 ADR** | ADR-011（In-Memory Task Queue） |
| **估算複雜度** | 中 |
| **建議模型** | Sonnet |
| **HITL 等級** | standard |

---

## 目標（Goal）

> 讓 Task 之間建立依賴關係（DAG），Queue 在執行時遵守依賴順序——被依賴的 task 必須先完成，才會執行下游 task。使用者可在建立 task 時指定前置任務，系統自動排程。

---

## 輸入規格（Inputs）

| 參數名稱 | 型別 | 來源 | 限制條件 |
|----------|------|------|----------|
| depends_on | string[] \| null | POST /tasks body（可選） | 陣列元素為合法 task ID；最多 10 個依賴；不可自依賴；不可形成循環 |

**依賴規則：**
- 依賴的 task 必須屬於同一 `workspace_id`（跨 workspace 依賴無意義）
- 依賴的 task 必須已存在（create 時驗證）
- 不允許循環依賴（DAG 驗證）
- 依賴的 task 狀態不限（可依賴已完成、pending、甚至 failed 的 task）

---

## 輸出規格（Expected Output）

**Task 建立成功（含依賴）：**
```json
{
  "id": "task_d4e5f6",
  "title": "Write unit tests",
  "dependsOn": ["task_a1b2c3", "task_x7y8z9"],
  "status": "pending",
  ...
}
```

**Task 列表（含依賴狀態）：**
```json
{
  "id": "task_d4e5f6",
  "title": "Write unit tests",
  "dependsOn": ["task_a1b2c3", "task_x7y8z9"],
  "dependencyStatus": "blocked",
  ...
}
```

**`dependencyStatus` 計算邏輯：**

| 依賴任務狀態 | dependencyStatus | 說明 |
|-------------|-----------------|------|
| 所有依賴皆 `completed` | `ready` | 可被 queue 執行 |
| 任一依賴為 `failed` / `cancelled` | `blocked` | 不可執行，需人工處理 |
| 其他（pending/running/awaiting_review 等） | `waiting` | 等待依賴完成 |
| 無依賴（`depends_on` 為 null 或空陣列） | `ready` | 無前置條件 |

**失敗情境：**

| 錯誤類型 | HTTP Code | 處理方式 |
|----------|-----------|----------|
| 依賴 task 不存在 | 400 | `{ error: "Dependency task_xxx not found", code: "DEPENDENCY_NOT_FOUND" }` |
| 循環依賴 | 400 | `{ error: "Circular dependency detected", code: "CIRCULAR_DEPENDENCY" }` |
| 跨 workspace 依賴 | 400 | `{ error: "Dependencies must be in the same workspace", code: "CROSS_WORKSPACE_DEPENDENCY" }` |
| 自依賴 | 400 | `{ error: "Task cannot depend on itself", code: "SELF_DEPENDENCY" }` |
| 依賴數量超過上限 | 400 | `{ error: "Maximum 10 dependencies allowed", code: "TOO_MANY_DEPENDENCIES" }` |

---

## 實作範圍

### 1. Server — `server/src/tasks/manager.ts`

**新增依賴驗證函式：**

```typescript
function validateDependencies(
  workspaceId: string,
  taskId: string | null,  // null for new tasks
  dependsOn: string[]
): void {
  // 1. 自依賴檢查
  if (taskId && dependsOn.includes(taskId)) throw ...

  // 2. 存在性檢查（批次查詢）
  const existing = db.prepare(
    `SELECT id, workspace_id FROM tasks WHERE id IN (${placeholders})`
  ).all(...dependsOn);

  // 3. 同 workspace 檢查
  // 4. 循環依賴檢查（DFS/BFS from each dependency）
}
```

**循環偵測演算法：**
- 從新 task 出發，遞迴追蹤 `depends_on` 鏈
- 若任一路徑回到新 task → 循環
- SQLite 查詢所有相關 task 的 `depends_on`，在記憶體中建 adjacency list 做 DFS
- 只查同 workspace 的 task（範圍有限，不會有效能問題）

**修改 `createTask()`：**
- 解析並驗證 `dependsOn` 陣列
- 序列化為 JSON string 存入 `depends_on` 欄位

**修改 `listTasks()`：**
- 回傳時附加 `dependencyStatus` 計算欄位

**新增 `getDependencyStatus()`：**
```typescript
function getDependencyStatus(task: Task): 'ready' | 'waiting' | 'blocked' {
  if (!task.depends_on) return 'ready';
  const deps = JSON.parse(task.depends_on) as string[];
  if (deps.length === 0) return 'ready';

  const depTasks = db.prepare(
    `SELECT id, status FROM tasks WHERE id IN (${placeholders})`
  ).all(...deps);

  if (depTasks.some(d => d.status === 'failed' || d.status === 'cancelled'))
    return 'blocked';
  if (depTasks.every(d => d.status === 'completed'))
    return 'ready';
  return 'waiting';
}
```

### 2. Server — `server/src/tasks/queue.ts`

**修改 `processNext()`：**

現有查詢：
```sql
SELECT * FROM tasks WHERE status = 'pending'
ORDER BY priority ASC, created_at ASC LIMIT 1
```

改為考慮依賴：
```typescript
// 1. 取得所有 pending tasks
const pendingTasks = db.prepare(
  `SELECT * FROM tasks WHERE status = 'pending'
   ORDER BY priority ASC, created_at ASC`
).all();

// 2. 過濾掉依賴未完成的 task
const readyTask = pendingTasks.find(task => {
  return getDependencyStatus(task) === 'ready';
});

// 3. 若無 ready task，queue 暫停（不 busy loop）
if (!readyTask) return;
```

**新增：依賴完成時觸發 queue：**
- 當一個 task 完成（`status → completed`）時，檢查是否有下游 task 因此變為 `ready`
- 若有，呼叫 `processNext()` 啟動下一個

### 3. Server — `server/src/routes/tasks.ts`

**修改 POST `/`：**
- Zod schema 新增 `dependsOn: z.array(z.string()).max(10).optional()`
- 呼叫 `validateDependencies()` 驗證
- 回傳完整 task（含 `dependencyStatus`）

**修改 GET `/`（list）：**
- 每個 task 附加 `dependencyStatus` 欄位

**修改 GET `/:id`：**
- 附加 `dependencyStatus` 欄位

**新增 GET `/:id/dependents`（可選）：**
- 回傳依賴此 task 的下游 task 列表

### 4. Server — `server/src/routes/tasks.ts` 狀態機調整

**`failed` / `cancelled` task 的下游處理：**
- 不自動 cascade cancel/fail 下游 task
- 下游 task 保持 `pending` 但 `dependencyStatus = blocked`
- 使用者可手動重新執行 failed task，或移除依賴

### 5. Client — `client/src/stores/tasks.ts`

- `createTask()` 新增 `dependsOn` 參數
- Task 列表回傳含 `dependencyStatus`

### 6. Client — `client/src/components/tasks/TaskCard.tsx`

- 顯示依賴 badge：
  - `ready`：綠色，可執行
  - `waiting`：黃色，等待中
  - `blocked`：紅色，被阻塞
- 顯示依賴 task 名稱列表（展開式）

### 7. Client — `client/src/components/tasks/TaskCreateSheet.tsx`

- 新增「依賴任務」選擇器：
  - 列出同 workspace 的 pending/running task
  - 多選 checkbox
  - 顯示已選依賴的 title

### 8. Shared Types — `shared/types.ts`

- `Task` interface 新增 `dependencyStatus?: 'ready' | 'waiting' | 'blocked'`
- 確認 `dependsOn` 已定義為 `string[]`（已存在）

---

## 邊界條件（Edge Cases）

- **依賴的 task 被刪除**：刪除 task 前檢查是否有下游依賴者，若有則拒絕刪除（400）或自動移除依賴引用
- **所有依賴都已完成，但 queue 正在處理其他 task**：task 排入等候佇列，待當前 task 完成後 `processNext()` 撈到它
- **依賴 task 被重新執行（status 從 completed 回到 pending/running）**：下游 task 的 `dependencyStatus` 動態重算，會從 `ready` 回到 `waiting`
- **大量 task 的 DAG（>50 nodes）**：SQLite 單次查詢同 workspace 所有 task 建 adjacency list，效能可接受
- **依賴 task 狀態為 `awaiting_review`**：算 `waiting`，需 approve 並完成後才會解鎖下游
- **新增依賴到已執行中的 task**：不允許修改 `running` 狀態 task 的 `dependsOn`
- **空陣列 `[]` vs `null`**：兩者皆視為「無依賴」，`dependencyStatus = ready`

---

## 驗收標準（Done When）

- [x] `npm --prefix server run test:run` 全數通過（含新增依賴相關測試）
- [x] `npm --prefix client run test:run` 全數通過
- [x] `cd server && npx tsc --noEmit` 無錯誤
- [x] `cd client && npx tsc --noEmit` 無錯誤
- [x] 建立 task 時可指定 `dependsOn`（API 回傳可驗證）
- [x] 循環依賴被正確拒絕（400 + error message）
- [x] Queue 自動跳過依賴未滿足的 task
- [x] 依賴 task 完成後，下游 task 自動被 queue 撈到執行
- [x] Task 列表正確顯示 `dependencyStatus`
- [x] Client UI 可選擇依賴任務
- [x] 刪除 task 前檢查下游依賴

---

## 禁止事項（Out of Scope）

- 不要實作：跨 workspace 依賴
- 不要實作：依賴 task 失敗時自動 cascade cancel 下游（保留手動決策權）
- 不要實作：條件依賴（「只在 task A 成功且 task B 失敗時執行」之類的複雜邏輯）
- 不要引入新依賴：純 TypeScript 實作循環偵測，不需要圖論函式庫
- 不要修改：DB schema（`depends_on TEXT` 欄位已存在）

---

## 參考資料（References）

- 相關 ADR：ADR-011（In-Memory Task Queue，提及 `depends_on` 預留欄位）
- 現有實作：
  - `server/src/tasks/queue.ts` — 當前 Queue 的 `processNext()` 查詢邏輯
  - `server/src/tasks/manager.ts` — `depends_on` 欄位已存在於 Task interface（JSON string，未解析）
  - DB schema：`tasks.depends_on TEXT`（已存在，JSON array of task IDs）
- 演算法：DAG cycle detection via DFS with visited set
