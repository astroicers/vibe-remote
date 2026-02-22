# [ADR-014]: Tailscale Zero-Trust 網路存取

| 欄位 | 內容 |
|------|------|
| **狀態** | `Accepted` |
| **日期** | 2026-02-18 |
| **決策者** | Project Owner |

---

## 背景（Context）

Vibe Remote 需要讓手機連到桌面 server。server 執行 AI + git 操作，安全性至關重要。需決定網路存取方式。

---

## 評估選項（Options Considered）

### 選項 A：Tailscale WireGuard Mesh VPN

- **優點**：零設定防火牆；端對端加密（WireGuard）；裝置身分驗證由 Tailscale 處理；100.x.y.z 私有 IP
- **缺點**：需要手機 + 桌面安裝 Tailscale
- **風險**：Tailscale 服務中斷影響連線

### 選項 B：Public Domain + TLS + WAF

- **優點**：任何網路皆可存取
- **缺點**：暴露於公網；需管理 SSL 憑證、防火牆規則、WAF 規則
- **風險**：攻擊面大（AI + bash 工具暴露在公網極度危險）

### 選項 C：SSH Tunnel

- **優點**：加密通道；無需安裝額外軟體
- **缺點**：手機上設定 SSH 不便；tunnel 斷線需手動重連
- **風險**：UX 差

---

## 決策（Decision）

選擇 **選項 A**：Tailscale。

安全設計推導：
- **不需要 HTTPS**：Tailscale WireGuard 已提供 transport encryption
- **不需要 CORS**：所有裝置在同一 Tailscale 網路，信任域
- **不需要 Helmet / CSP**：無公網暴露，無 XSS 攻擊面
- **不需要 rate limiting on REST**：WebSocket rate limit 足夠（10 msg/min per device）

結果：server 可以用純 HTTP（無 TLS）監聽 0.0.0.0:8080，只有 Tailscale 裝置能連入。

---

## 後果（Consequences）

**正面影響：**
- 極簡安全模型：Tailscale 裝置身分 = 網路層認證
- 無需管理 SSL 憑證
- AI + bash 工具不暴露於公網

**負面影響 / 技術債：**
- 不支援非 Tailscale 裝置存取（有意為之）
- 若未來需開放公網存取，需加入 TLS、CORS、Helmet、WAF

**後續追蹤：**
- [x] Server 監聽 0.0.0.0:8080（Tailscale only）
- [x] 無 CORS 限制（`cors()` 無參數）
- [ ] 若有公網需求，建立 ADR 評估安全措施

---

## 關聯（Relations）

- 取代：（無）
- 被取代：（無）
- 參考：ADR-004（JWT 認證作為應用層防護）
