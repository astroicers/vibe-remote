# SPEC-012：擴充 .env 可配置參數

> 追溯規格書——實作已於當前 session 完成。

| 欄位 | 內容 |
|------|------|
| **規格 ID** | SPEC-012 |
| **關聯 ADR** | 無 |
| **估算複雜度** | 低 |
| **建議模型** | Sonnet |
| **HITL 等級** | minimal |

---

## 目標（Goal）

> 將 server 中高影響力的硬編碼常數提升為環境變數配置，讓不同部署環境可透過 `.env` 調整行為，而非修改原始碼。同時補齊 `.env.example` 文件。

---

## 輸入規格（Inputs）

新增 8 個環境變數（全部選填，有合理預設值）：

| 變數名 | 型別 | 預設值 | 說明 |
|--------|------|--------|------|
| `MAX_CONCURRENT_RUNNERS` | number | `3` | 最大並行 AI runner 數 |
| `MAX_TURNS_CHAT` | number | `20` | Chat 訊息最大 agentic turns |
| `MAX_TURNS_TASK` | number | `30` | 背景任務最大 agentic turns |
| `RATE_LIMIT_WINDOW_MS` | number | `60000` | 速率限制時間窗口 (ms) |
| `RATE_LIMIT_MAX_REQUESTS` | number | `10` | 每窗口最大請求數 |
| `CORS_ORIGIN` | string | `*` | 允許的 CORS origin（`*` 或逗號分隔） |
| `TOOL_APPROVAL_TIMEOUT_MS` | number | `120000` | Tool approval 等待逾時 (ms) |
| `CONTEXT_HISTORY_COUNT` | number | `5` | 注入 AI context 的歷史訊息數 |

同時補齊 2 個已存在但未記錄的變數：`RUNNER_TIMEOUT_MS`, `TOOL_APPROVAL_ENABLED`。

---

## 輸出規格（Expected Output）

所有新環境變數都有合理預設值，不設定任何新 env 時行為與改動前完全一致。

---

## 邊界條件（Edge Cases）

- Case 1：不設定任何新 env → 全部使用預設值，行為不變
- Case 2：`CORS_ORIGIN=*` → `cors({ origin: true })`，等同原本的 `cors()`
- Case 3：`CORS_ORIGIN=https://app.example.com,https://admin.example.com` → 多來源陣列
- Case 4：測試環境 mock config → 需補齊新欄位

---

## 驗收標準（Done When）

- [x] `cd server && npx tsc --noEmit` 無錯誤
- [x] `cd client && npx tsc --noEmit` 無錯誤
- [x] `npm --prefix server run test:run` 全數通過（155 tests）
- [x] `npm --prefix client run test:run` 全數通過（139 tests）
- [x] `.env.example` 包含所有可配置參數

---

## 禁止事項（Out of Scope）

- 不將 client 端常數提升為 env（client 不讀 env）
- 不修改模型 ID 列表（需配對 display name）
- 不修改細粒度截斷長度（太細節，改了可能破壞 UI）

---

## 參考資料（References）

- 修改檔案：`config.ts`, `chat-handler.ts`, `rate-limit.ts`, `tool-approval.ts`, `tasks/runner.ts`, `index.ts`, `truncate.ts`, `.env.example`
- 測試修復：`tasks/runner.test.ts`（補齊 mock config 欄位）
