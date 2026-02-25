# SPEC-013：Auth 韌性修復 — 靜默續期 + 401 自動登出 + WS auth 錯誤處理

| 欄位 | 內容 |
|------|------|
| **規格 ID** | SPEC-013 |
| **關聯 ADR** | 無（使用既有 JWT 機制，無架構變更） |
| **估算複雜度** | 中 |
| **建議模型** | Opus |
| **HITL 等級** | standard |

---

## 目標（Goal）

> 修復 3 個 auth 相關問題：(1) JWT 過期後無自動續期機制，使用者需重新配對；(2) Client 不攔截 401 錯誤做自動登出；(3) WebSocket auth_error 未處理。同時改善前端 auth 錯誤的除錯訊息。

---

## 輸入規格（Inputs）

### Issue 1: 靜默續期
- Server middleware 檢查 token 剩餘有效期 < 24h 時，自動簽發新 token
- 新 token 透過 `X-Renewed-Token` response header 回傳
- Client 攔截此 header，靜默替換 localStorage 中的 token

### Issue 2: 401 自動登出
- Client `request()` 偵測 401 response
- 依 error code 顯示對應中文 toast
- 呼叫 `logout()` 清除 auth state
- 冷啟動 `checkAuth()` 期間抑制 toast（避免首次載入閃 toast）

### Issue 3: WS auth_error 處理
- Server WS auth 錯誤增加 `code` 欄位
- Server 在 chat message 處理前驗證 token 是否已過期
- Client 監聽 `auth_error` 和 `auth_expired` WS 事件
- 觸發 logout + toast

---

## 輸出規格（Expected Output）

- Token 接近過期時，使用者無感知地獲得新 token
- Token 已過期時，清晰的中文 toast 告知使用者需重新配對
- WS 連線中 token 過期，同樣有清晰的錯誤提示

---

## 邊界條件（Edge Cases）

- Case 1：token 剩餘 > 24h → 不觸發續期，行為不變
- Case 2：token 剩餘 < 24h → response header 含新 token，client 靜默替換
- Case 3：token 已過期 → 401 + toast + 自動登出
- Case 4：冷啟動無 token → `checkAuth()` 失敗但不顯示 toast
- Case 5：WS 連線中 token 過期 → `auth_expired` 事件 + toast + logout
- Case 6：裝置被管理員刪除 → 401 DEVICE_REVOKED + 對應 toast

---

## 驗收標準（Done When）

- [x] `cd server && npx tsc --noEmit` 無錯誤
- [x] `cd client && npx tsc --noEmit` 無錯誤
- [x] `npm --prefix server run test:run` 全數通過（155 tests）
- [x] `npm --prefix client run test:run` 全數通過（139 tests）
- [x] Server middleware 在 token 剩餘 < 24h 時回傳 `X-Renewed-Token` header
- [x] Client 攔截 `X-Renewed-Token` 並更新 localStorage
- [x] Client 收到 401 時自動 logout + 顯示中文 toast
- [x] Client 處理 WS `auth_error` 和 `auth_expired` 事件
- [x] 開發模式有 console debug log

---

## 禁止事項（Out of Scope）

- 不實作 refresh token 機制（YAGNI，靜默續期已足夠）
- 不新增 DB table 或 column
- 不修改 JWT payload 結構

---

## 參考資料（References）

- 修改檔案：`jwt.ts`, `middleware.ts`, `index.ts`, `chat-handler.ts`, `api.ts`, `auth.ts`, `websocket.ts`, `App.tsx`
