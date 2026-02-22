# [ADR-006]: WebSocket 串流架構設計

| 欄位 | 內容 |
|------|------|
| **狀態** | `Accepted` |
| **日期** | 2026-02-18 |
| **決策者** | Project Owner |

---

## 背景（Context）

AI 回應需要即時串流（逐字顯示），tool 使用需要即時通知，檔案變更需要即時推送。需決定 real-time 通訊架構。

---

## 評估選項（Options Considered）

### 選項 A：單一 WebSocket 端點 + JSON 訊息分類

- **優點**：單一持久連線；透過 `type` 欄位 demux；auth/chat/tool_approval/status 共用
- **缺點**：所有事件在同一 stream，client 需 filter
- **風險**：訊息量大時可能需要流量控制

### 選項 B：Server-Sent Events（SSE）

- **優點**：HTTP-based，自動重連
- **缺點**：單向（server → client）；tool approval 需額外 REST endpoint
- **風險**：無法從 client push 訊息

### 選項 C：Socket.IO

- **優點**：自動重連、room 機制、namespace
- **缺點**：大量依賴（~100KB）；overhead（polling fallback）
- **風險**：版本不相容問題

---

## 決策（Decision）

選擇 **選項 A**：單一 `/ws` 端點 + `express-ws`。

關鍵設計：
- **連線後先認證**：send `{ type: 'auth', token }` → server 回 `auth_success` 或 `auth_error`
- **串流事件類型**：`text`（AI 文字）、`tool_use`（AI 使用工具）、`tool_result`（工具結果）、`token_usage`（token 統計）、`error`、`done`
- **Chat handler**：`Map<string, RunnerState>` 追蹤 active runners（key = `workspaceId:conversationId`）
- **廣播機制**：`Set<AuthenticatedSocket>` 追蹤所有連線，file change events 廣播至所有 client
- **Rate limiting**：per-device sliding window，10 msg/min

---

## 後果（Consequences）

**正面影響：**
- AI 回應即時逐字顯示（300ms 內感知延遲）
- Tool approval 雙向通訊（server push 請求 → client approve/reject）
- 檔案變更即時推送至所有裝置

**負面影響 / 技術債：**
- 自行實作重連邏輯（exponential backoff 1s → 16s，最多 5 次）
- 無 room/namespace 機制，client 需依 workspaceId 過濾事件
- 連線斷開時 pending message queue 可能遺失

**後續追蹤：**
- [x] Client auto-reconnect with exponential backoff
- [x] Pending message queue（連線恢復後重送）
- [ ] WebSocket heartbeat / ping-pong 機制

---

## 關聯（Relations）

- 取代：（無）
- 被取代：（無）
- 參考：ADR-003（SDK streaming events）、ADR-005（per-workspace state）、ADR-016（concurrent runners）
