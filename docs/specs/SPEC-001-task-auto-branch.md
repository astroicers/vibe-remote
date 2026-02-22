# SPEC-001：Task Auto Branch

> 結構完整的規格書讓 AI 零確認直接執行。

| 欄位 | 內容 |
|------|------|
| **規格 ID** | SPEC-001 |
| **關聯 ADR** | ADR-011（In-Memory Task Queue） |
| **估算複雜度** | 中 |
| **建議模型** | Sonnet |
| **HITL 等級** | standard |

---

## 目標（Goal）

> 每個 Task 執行時自動建立獨立 Git branch，讓 AI 產生的變更隔離在專屬分支，避免污染主分支，且方便 diff review 後合併或丟棄。

---

## 輸入規格（Inputs）

| 參數名稱 | 型別 | 來源 | 限制條件 |
|----------|------|------|----------|
| branch | string \| null | POST /tasks body（可選） | 長度 1-100，合法 Git branch 名稱（無空白、`~`、`^`、`:`、`?`、`*`、`[`、`\`） |
| auto_branch | boolean | POST /tasks body（可選，預設 true） | - |

**branch 命名規則：**
- 若使用者提供 `branch`：直接使用
- 若 `auto_branch = true` 且未提供 `branch`：自動產生 `task/<task_id_short>-<slug>` 格式
  - `task_id_short`：task ID 去掉 `task_` prefix
  - `slug`：title 轉 kebab-case，截取前 40 字元
  - 範例：`task/a1b2c3-fix-login-redirect`
- 若 `auto_branch = false`：不建立分支，維持現有行為（直接在當前分支工作）

---

## 輸出規格（Expected Output）

**Task 建立成功（branch 欄位）：**
```json
{
  "id": "task_a1b2c3d4",
  "title": "Fix login redirect",
  "branch": "task/a1b2c3d4-fix-login-redirect",
  "status": "pending",
  ...
}
```

**Task 執行時 Git 操作流程：**
```
1. processNext() 取得 pending task
2. 若 task.branch 不為 null：
   a. git stash（暫存當前 working tree 變更）
   b. 從當前 HEAD 建立並切換到 task.branch
   c. 執行 AI runner
   d. AI 完成後，變更留在 task.branch
3. 若 task.branch 為 null：
   直接在當前分支執行 AI runner（現有行為）
```

**Task 完成後：**
- 不自動切回原分支（留在 task branch 以便 diff review）
- Diff review 的 `GET /diff/current` 需顯示 task branch vs 原分支的差異

**失敗情境：**

| 錯誤類型 | HTTP Code | 處理方式 |
|----------|-----------|----------|
| branch 名稱不合法 | 400 | `{ error: "Invalid branch name", code: "VALIDATION_ERROR" }` |
| branch 已存在 | 409 | `{ error: "Branch already exists", code: "BRANCH_EXISTS" }` |
| git stash 失敗 | 500 | Task 標記 failed，error 記錄原因 |
| branch checkout 失敗 | 500 | Task 標記 failed，嘗試 unstash 回復 |

---

## 實作範圍

### 1. Server — `server/src/tasks/manager.ts`

- `CreateTaskInput` 新增 `autoBranch?: boolean` 欄位（預設 `true`）
- `createTask()` 內：
  - 若 `autoBranch = true` 且未提供 `branch`：自動產生 branch 名稱
  - 若提供 `branch`：驗證名稱合法性（`git check-ref-format --branch`）
  - 將 `branch` 存入 DB

### 2. Server — `server/src/tasks/runner.ts`

- `runTask()` 開頭新增 branch 處理：
  ```typescript
  if (task.branch) {
    const git = simpleGit(workspace.path);
    await git.stash();
    await git.checkoutLocalBranch(task.branch);
  }
  ```
- 失敗時加入 cleanup：嘗試 checkout 回原分支 + `git stash pop`

### 3. Server — `server/src/workspace/git-ops.ts`

- 新增 helper 函式：
  - `createAndCheckoutBranch(workspacePath: string, branchName: string): Promise<void>`
  - `branchExists(workspacePath: string, branchName: string): Promise<boolean>`
  - `getCurrentBranch(workspacePath: string): Promise<string>`
  - `stashChanges(workspacePath: string): Promise<string>` — 回傳 stash ref
  - `popStash(workspacePath: string): Promise<void>`

### 4. Server — `server/src/routes/tasks.ts`

- POST `/` 的 zod schema 新增 `branch` 和 `autoBranch` 欄位
- 新增 branch 名稱驗證（regex + 長度限制）

### 5. Client — `client/src/stores/tasks.ts`

- `createTask()` 新增 `autoBranch` 參數
- Task 列表顯示 branch 名稱

### 6. Client — `client/src/components/tasks/TaskCard.tsx`

- 顯示 branch badge（若 `task.branch` 存在）

### 7. Client — `client/src/components/tasks/TaskCreateSheet.tsx`

- 新增 branch 選項：
  - Toggle：「Auto create branch」（預設開啟）
  - 可選 input：自訂 branch 名稱

---

## 邊界條件（Edge Cases）

- **工作區有未提交變更時**：執行 `git stash` 保存；若 stash 失敗（如 untracked files 衝突），task 標記 `failed`
- **branch 已存在**：在 `createTask()` 時檢查並拒絕（409），不等到執行時才發現
- **Task 取消時已在 branch 上**：`cancel()` 不負責 checkout 回原分支，留給使用者手動處理或下一個 task 的 stash 機制處理
- **並發 task 時（未來支援多 runner）**：每個 task 各自 stash + checkout，simple-git 操作需加 workspace-level lock（Phase 2+ 議題）
- **Branch 名稱過長**：截取 slug 至 40 字元，總長度不超過 100 字元
- **空 title 產生空 slug**：fallback 使用 `task/<task_id_short>`

---

## 驗收標準（Done When）

- [ ] `npm --prefix server run test:run` 全數通過（含新增 branch 相關測試）
- [ ] `npm --prefix client run test:run` 全數通過
- [ ] `cd server && npx tsc --noEmit` 無錯誤
- [ ] `cd client && npx tsc --noEmit` 無錯誤
- [ ] 建立 task 時 branch 欄位正確產生（API 回傳可驗證）
- [ ] Task 執行時自動建立 Git branch 並切換
- [ ] Task 完成後變更保留在 task branch 上
- [ ] Diff review 可看到 task branch 的變更
- [ ] Task 失敗時 workspace 恢復到原始狀態（stash pop）

---

## 禁止事項（Out of Scope）

- 不要實作：自動合併 task branch 回主分支（由 diff review approve 決定）
- 不要實作：多 branch 並行工作（Phase 2+ 多 runner 議題）
- 不要引入新依賴：使用現有 `simple-git` 套件即可
- 不要修改：DB schema（`branch` 欄位已存在）

---

## 參考資料（References）

- 相關 ADR：ADR-011（In-Memory Task Queue）、ADR-013（Diff Review）
- 現有實作：
  - `server/src/tasks/runner.ts` — 當前 runner（無 branch 處理）
  - `server/src/workspace/git-ops.ts` — 現有 Git 操作
  - `server/src/tasks/queue.ts` — Queue 執行流程
- DB schema：`tasks.branch TEXT`（已存在，允許 NULL）
