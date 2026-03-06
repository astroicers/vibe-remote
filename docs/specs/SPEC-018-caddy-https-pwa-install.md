# SPEC-018：Caddy HTTPS Reverse Proxy（Android PWA 安裝支援）

> 追溯規格書——實作已完成。

| 欄位 | 內容 |
|------|------|
| **規格 ID** | SPEC-018 |
| **關聯 ADR** | ADR-020 |
| **估算複雜度** | 低 |
| **建議模型** | Haiku |
| **HITL 等級** | minimal |

---

## 🎯 目標（Goal）

> 透過 Caddy reverse proxy 提供 HTTPS，讓 Android Chrome 能將 PWA 安裝為完整應用程式（而非僅新增捷徑）。應用程式碼零修改。

---

## 📥 輸入規格（Inputs）

### Docker Compose 設定

| 參數名稱 | 型別 | 來源 | 限制條件 |
|----------|------|------|----------|
| Caddyfile | 檔案 | 專案根目錄 | 包含 `tls internal` 指令 |
| HTTPS port | number | docker-compose.yml | 預設 8443→443 映射 |

### 無環境變數變動

Caddy 自主管理憑證，不需要 Express 端的 SSL 環境變數。

---

## 📤 輸出規格（Expected Output）

**HTTPS 健康檢查：**
```
$ curl -k https://localhost:8443/api/health
{"status":"ok","timestamp":"...","version":"0.1.0"}
```

**CA 憑證匯出：**
```
$ ./scripts/export-ca.sh
CA certificate exported to: ./caddy-root-ca.crt
```

---

## 🔗 副作用與連動（Side Effects）

| 本功能的狀態變動 | 受影響的既有功能 | 預期行為 |
|-----------------|----------------|---------|
| 外部存取改由 Caddy 代理 | Client WebSocket 連線 | `wss://` 自動偵測，透明代理 |
| vibe-remote 不再直接對外開放 port | Docker healthcheck | 維持內部 HTTP check 不變 |

---

## ⚠️ 邊界條件（Edge Cases）

- **Port 80/443 被佔用**：使用替代 port（如 `8443:443`），不影響 Caddy 內部運作
- **Caddy 容器重啟**：CA 資料持久化於 `caddy-data` volume，不會重新產生
- **多裝置同時連線**：Caddy 透明代理，不影響既有的 WS 多裝置架構
- **本地開發**：Vite dev server + HTTP proxy 不受影響，Caddy 僅存在於 Docker 部署

### 回退方案（Rollback Plan）

- **回退方式**：revert commit + `docker compose down` + 恢復原 `ports: ["8080:8080"]`
- **不可逆評估**：無不可逆變更（Caddy volumes 可安全刪除）
- **資料影響**：無，不影響 DB 或使用者資料

---

## ✅ 驗收標準（Done When）

- [x] Caddyfile 包含 `tls internal` + `reverse_proxy`
- [x] docker-compose.yml 包含 caddy 服務
- [x] vibe-remote 改為 `expose`（不直接對外）
- [x] `curl -k https://localhost:8443/api/health` 回傳 ok
- [x] `./scripts/export-ca.sh` 成功匯出有效 CA 憑證
- [x] WebSocket 透過 WSS 正常連線
- [x] `npm --prefix server run test:run` 全數通過（187）
- [x] `npm --prefix client run test:run` 全數通過（158）
- [x] .gitignore 排除憑證檔案
- [x] .env.example 包含 HTTPS 使用說明

---

## 🚫 禁止事項（Out of Scope）

- 不要修改：Express server（index.ts）、config.ts、client 程式碼
- 不要實作：自動 CA 安裝到 Android（需手動操作）
- 不要引入：Express 端的 SSL 環境變數或 https.createServer

---

## 📎 參考資料（References）

- 關聯 ADR：ADR-020
- 實作 commit：（待 commit）
- Caddy TLS internal：https://caddyserver.com/docs/caddyfile/directives/tls
- Caddy reverse_proxy：https://caddyserver.com/docs/caddyfile/directives/reverse_proxy
