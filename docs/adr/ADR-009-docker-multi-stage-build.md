# [ADR-009]: Docker 多階段建構 + 單容器部署

| 欄位 | 內容 |
|------|------|
| **狀態** | `Accepted` |
| **日期** | 2026-02-19 |
| **決策者** | Project Owner |

---

## 背景（Context）

需要將 server + client 打包為 Docker image 部署。server 需要 native module 編譯環境（better-sqlite3），client 需要 Vite 建構。需決定建構策略和部署架構。

---

## 評估選項（Options Considered）

### 選項 A：三階段建構（client-build → server-build → runtime）

- **優點**：runtime image 不含 build tools（python3, make, g++）；image 較小
- **缺點**：建構時間較長（三個 stage）
- **風險**：stage 間 COPY 需注意路徑

### 選項 B：單階段建構

- **優點**：Dockerfile 簡單
- **缺點**：runtime image 包含所有 build tools（bloated）
- **風險**：安全性（不必要的 build tools in production）

### 選項 C：分離容器（server + client 各一個 container）

- **優點**：獨立擴展
- **缺點**：需要 nginx 反向代理；部署複雜度增加
- **風險**：過度工程化

---

## 決策（Decision）

選擇 **選項 A**：三階段建構 + 單容器部署。

建構流程：
1. **client-build**：Node 22 slim → `npm ci` → `vite build` → 產出 `dist/`
2. **server-build**：Node 22 slim + python3/make/g++ → `npm ci`（含 better-sqlite3 編譯）→ 複製 server source
3. **runtime**：Node 22 slim + git/curl → 安裝 Claude CLI → 複製 server 成品 + client dist → `USER node` → `npx tsx src/index.ts`

單容器設計：server port 8080 同時服務 API + 靜態 client 檔案。

---

## 後果（Consequences）

**正面影響：**
- runtime image 不含 python3/make/g++（安全、smaller）
- 單容器 + docker-compose 一鍵部署
- `USER node` 避免以 root 執行

**負面影響 / 技術債：**
- Claude CLI 需在 runtime stage 重新安裝（約 30s）
- `tsx` 直接執行 TypeScript（非預編譯），啟動稍慢
- image size 仍偏大（含 Claude CLI + git）

**後續追蹤：**
- [x] Health check：`curl http://localhost:8080/api/health`
- [x] Volumes：`vibe-data`（DB）、`~/.claude`（credentials）、workspace mount
- [ ] 評估預編譯 TS → JS 減少 runtime 依賴

---

## 關聯（Relations）

- 取代：（無）
- 被取代：（無）
- 參考：ADR-001、ADR-002（better-sqlite3 需 build tools）
