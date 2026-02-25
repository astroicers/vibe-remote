# SPEC-014：專案品質審計修復

| 欄位 | 內容 |
|------|------|
| **規格 ID** | SPEC-014 |
| **關聯 ADR** | 無（皆為既有架構下的 bug fix / hardening） |
| **估算複雜度** | 中 |
| **建議模型** | Opus |
| **HITL 等級** | standard |

---

## 目標（Goal）

> 修復全面品質審計中發現的 3 個 CRITICAL/HIGH 問題和 5 個 MEDIUM 問題，提升專案穩定性與韌性。

---

## 輸入規格（Inputs）

### CRITICAL: setInterval 未在 shutdown 清理
- `chat-handler.ts` 的 stale runner cleanup `setInterval` 無保存 handle
- SIGTERM/SIGINT 時無法 clearInterval

### HIGH: JSON.parse 無 try-catch
- `routes/chat.ts` 中 2 處 `JSON.parse()` 無保護（tool_calls, tool_results）
- DB 資料損壞時會 crash

### HIGH: ReviewStatus 枚舉不一致
- DB schema (`schema.ts`) 用 `'partial'`
- `shared/types.ts` 用 `'commented'`

### MEDIUM: DB 缺少關鍵 index
- `conversations(updated_at)`、`messages(conversation_id, created_at)` 複合、`tasks(workspace_id, status)` 複合

### MEDIUM: SQLite busy_timeout 未設定
- 並行存取可能直接 SQLITE_BUSY 錯誤

### MEDIUM: DB migration 偵測方式不佳
- 用 INSERT/DELETE 測試 CHECK constraint，改用 PRAGMA table_info

### MEDIUM: Client 無 React Error Boundary
- 渲染錯誤會白屏

### MEDIUM: SettingsPage 空 catch block
- models 和 devices 載入失敗靜默忽略

---

## 輸出規格（Expected Output）

- Server graceful shutdown 正確清理所有 timer
- JSON.parse 有 fallback，不因損壞資料 crash
- 型別定義與 DB schema 一致
- 常用查詢有 index 加速
- SQLite 並行存取有 busy_timeout 保護
- Client 有 ErrorBoundary 防白屏
- Settings 載入錯誤有 console.warn

---

## 邊界條件（Edge Cases）

- Case 1：tool_calls JSON 損壞 → fallback 為純文字 content
- Case 2：SIGTERM 時 setInterval 正確清理
- Case 3：SQLite busy → 等待 5s 後 retry

---

## 驗收標準（Done When）

- [x] `cd server && npx tsc --noEmit` 無錯誤
- [x] `cd client && npx tsc --noEmit` 無錯誤
- [x] `npm --prefix server run test:run` 全數通過（187 tests）
- [x] `npm --prefix client run test:run` 全數通過（152 tests）
- [x] setInterval handle 已導出，shutdown 時 clearInterval
- [x] JSON.parse 有 try-catch fallback
- [x] ReviewStatus 統一為 'partial'
- [x] 新增 3 個 DB index
- [x] busy_timeout 已設定
- [x] migration 改用 PRAGMA 偵測
- [x] Client 有 ErrorBoundary
- [x] SettingsPage catch 有 console.warn

---

## 禁止事項（Out of Scope）

- 不修改 CORS 設定（內網工具，`*` 可接受）
- 不修改 WS pending 訊息上限
- 不修改 snake_case/camelCase 混用（既有 pattern）
- 不升級 React 版本

---

## 參考資料（References）

- 修改檔案：`chat-handler.ts`, `index.ts`, `chat.ts`(routes), `shared/types.ts`, `schema.ts`, `db/index.ts`, `App.tsx`, `SettingsPage.tsx`
