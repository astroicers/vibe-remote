# ADR-020：Caddy HTTPS Reverse Proxy（PWA 安裝支援）

| 欄位 | 內容 |
|------|------|
| **狀態** | `Accepted` |
| **日期** | 2026-03-07 |
| **決策者** | 專案維護者 |

---

## 背景（Context）

> Android 用戶反映 PWA 只能「新增捷徑」而無法「安裝應用程式」。調查發現 manifest、service worker、icons 全部正確，唯一缺失是 HTTPS——Android Chrome 強制要求 HTTPS 才能觸發完整 PWA 安裝流程。
>
> 部署環境為內網，需使用自簽憑證。

---

## 評估選項（Options Considered）

### 選項 A：修改 Express 直接建立 HTTPS Server

- **優點**：無額外容器，最少移動部件
- **缺點**：TLS 是 infra concern 卻混入 app 程式碼；需手動 openssl 產生 CA；影響本地開發流程（需條件切換 HTTP/HTTPS）；Node.js 啟動時快取憑證，續期需重啟
- **風險**：應用程式碼與基礎設施耦合，增加維護成本

### 選項 B：Caddy Reverse Proxy

- **優點**：關注點完全分離（app 不動）；`tls internal` 自動產生完整 CA（可匯出安裝到 Android）；WSS 自動代理；4 行 Caddyfile；本地開發零影響；憑證自動續期
- **缺點**：多一個 Docker 容器（~40MB image、~10MB RAM）
- **風險**：低——Caddy 是成熟穩定的單一二進位檔

### 選項 C：Nginx Reverse Proxy

- **優點**：關注點分離；業界廣泛使用
- **缺點**：~30 行 nginx.conf；需手動 openssl 產生 CA；WebSocket 需明確設定 `proxy_set_header Upgrade`；憑證續期全手動
- **風險**：WebSocket 設定遺漏會導致 WS 連線失敗

### 選項 D：Traefik

- **優點**：Label-based 設定；WebSocket 自動代理
- **缺點**：無 `tls internal` 等效功能；設計為多服務場景，單服務過度工程化；學習曲線高
- **風險**：複雜度不匹配部署規模

---

## 決策（Decision）

> 我們選擇 **選項 B（Caddy Reverse Proxy）**，因為：
>
> 1. **CA 自動產生**：`tls internal` 自動建立完整 CA，root cert 可從已知路徑匯出安裝到 Android，解決 PWA 安裝問題
> 2. **關注點分離**：Express 維持純 HTTP，TLS 由專責 infra 元件處理，應用程式碼零修改
> 3. **WebSocket 透明代理**：Caddy 自動偵測 `Connection: Upgrade` 處理 WSS
> 4. **最小設定量**：4 行 Caddyfile，遠少於其他方案

---

## 後果（Consequences）

**正面影響：**
- Android 用戶可透過 HTTPS 安裝完整 PWA（非僅捷徑）
- 應用程式碼維持純 HTTP，開發/測試流程不受影響
- 部署架構清楚分層：Caddy（TLS termination）→ Express（app logic）

**負面影響 / 技術債：**
- Docker Compose 多一個服務需管理
- 用戶需手動安裝 CA 憑證到 Android 裝置

**後續追蹤：**
- [x] Caddyfile 建立並驗證
- [x] docker-compose.yml 加入 Caddy 服務
- [x] CA 匯出腳本建立並驗證
- [ ] 撰寫使用者文件（Android CA 安裝步驟）

---

## 成功指標（Success Metrics）

| 指標 | 目標值 | 驗證方式 | 檢查時間 |
|------|--------|----------|----------|
| HTTPS health check | 回傳 `{"status":"ok"}` | `curl -k https://localhost:8443/api/health` | 部署後 |
| CA 匯出 | 有效的 X.509 CA 憑證 | `openssl x509 -in ca.crt -text` | 部署後 |
| Android PWA 安裝 | Chrome 顯示「安裝應用程式」 | 手動測試 | CA 安裝後 |
| 測試無回歸 | 345 tests pass | `npm --prefix server/client run test:run` | 部署後 |

---

## 關聯（Relations）

- 取代：無
- 被取代：無
- 參考：SPEC-018
