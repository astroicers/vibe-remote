# [ADR-004]: JWT + QR Code 裝置配對認證

| 欄位 | 內容 |
|------|------|
| **狀態** | `Accepted` |
| **日期** | 2026-02-18 |
| **決策者** | Project Owner |

---

## 背景（Context）

Vibe Remote 的使用情境是手機遠端操控桌面 server。需要安全地配對裝置，且認證方式要適合 mobile 操作（不方便輸入長密碼）。

---

## 評估選項（Options Considered）

### 選項 A：JWT + QR Code 配對

- **優點**：QR 掃描即配對，無需輸入；JWT 無狀態；可設裝置名稱方便管理
- **缺點**：Token 竊取後 7 天有效；需 DB 查詢驗證裝置未被撤銷
- **風險**：QR session 存於記憶體，server 重啟遺失

### 選項 B：OAuth 2.0（GitHub / Google）

- **優點**：成熟標準；SSO
- **缺點**：需要外部服務；私有工具不需要第三方帳號
- **風險**：外部服務中斷影響使用

### 選項 C：共享密碼 / API Key

- **優點**：簡單
- **缺點**：不安全（明文傳輸風險）；無法區分裝置
- **風險**：密碼洩漏後所有裝置暴露

---

## 決策（Decision）

選擇 **選項 A**：JWT + QR Code 配對。

關鍵設計：
- QR 配對流程：server 產生 6 字元 code + 5 分鐘有效期 → QR 編碼 → 手機掃描 → 送 code 換 JWT
- 配對 session 存於 `Map<string, PairingSession>`（記憶體），每分鐘清理過期
- JWT payload：`{ deviceId, deviceName }`，有效期 `JWT_EXPIRES_IN`（預設 7 天）
- `authMiddleware` 每次請求驗證：token 有效 + 裝置未被撤銷 + 更新 `last_seen_at`
- 開發模式提供 `devQuickPair` 捷徑（跳過 QR 掃描）

---

## 後果（Consequences）

**正面影響：**
- 零外部依賴的安全認證
- 支援多裝置管理（裝置列表 + 撤銷）
- 每次請求更新 `last_seen_at` 方便監控

**負面影響 / 技術債：**
- QR session 記憶體存儲，server 重啟後需重新配對（可接受）
- Token 竊取後需手動撤銷裝置
- 前端 QR 掃描 UI 尚未完整實作（目前使用 dev quick-pair）

**後續追蹤：**
- [x] Server API 完整實作
- [x] Dev quick-pair 捷徑
- [ ] 前端 QR 掃描器 UI
- [ ] Settings 頁面裝置管理 UI

---

## 關聯（Relations）

- 取代：（無）
- 被取代：（無）
- 參考：ADR-014（Tailscale 網路安全）
