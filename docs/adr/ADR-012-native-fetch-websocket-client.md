# [ADR-012]: 使用原生 Fetch + WebSocket（無第三方 HTTP client）

| 欄位 | 內容 |
|------|------|
| **狀態** | `Accepted` |
| **日期** | 2026-02-18 |
| **決策者** | Project Owner |

---

## 背景（Context）

Client 需要 REST API client 和 WebSocket client。需決定使用現有函式庫還是原生 API。

---

## 評估選項（Options Considered）

### 選項 A：原生 fetch + 自訂 wrapper / 原生 WebSocket + auto-reconnect

- **優點**：零依賴；bundle size 最小；完全控制行為
- **缺點**：需自行實作 error handling、token injection、reconnect
- **風險**：自訂程式碼可能有 edge case

### 選項 B：Axios + Socket.IO

- **優點**：成熟 API；自動 retry；Socket.IO 自動 reconnect + fallback
- **缺點**：Axios ~30KB、Socket.IO ~100KB；增加 bundle size
- **風險**：Socket.IO polling fallback 與 express-ws 不相容

### 選項 C：TanStack Query + native WS

- **優點**：自動 cache invalidation、retry、dedup
- **缺點**：學習成本；大部分 API call 是一次性（非 reactive query）
- **風險**：over-engineering

---

## 決策（Decision）

選擇 **選項 A**：原生 API + 自訂 wrapper。

REST client 設計（`api.ts`）：
- `request<T>(endpoint, options)` 泛型函式：自動注入 JWT token、JSON serialize、統一 error 格式（`ApiError` with status/code/message）
- 各 domain 分組：`auth.*`、`workspaces.*`、`diff.*`、`chat.*`、`tasks.*`

WebSocket client 設計（`websocket.ts`）：
- Singleton instance（全 app 共用一個連線）
- Auto-reconnect：exponential backoff（1s → 2s → 4s → 8s → 16s，最多 5 次）
- Handler registry：`ws.on(type, handler)` + wildcard `ws.on('*', handler)`
- Pending queue：連線中斷時 queue 訊息，恢復後依序送出

---

## 後果（Consequences）

**正面影響：**
- 零額外依賴；bundle size 最小化
- 完全控制 WebSocket reconnect 策略
- TypeScript 泛型確保 API response 型別安全

**負面影響 / 技術債：**
- 無自動 retry（REST call 失敗即拋錯）
- 無 request deduplication
- WebSocket reconnect 邏輯需自行測試 edge case

**後續追蹤：**
- [x] REST wrapper with JWT injection
- [x] WebSocket auto-reconnect
- [ ] 評估是否需要 REST retry 機制

---

## 關聯（Relations）

- 取代：（無）
- 被取代：（無）
- 參考：ADR-006（WebSocket 架構）
