# [ADR-016]: 並行 AI Runner 管理（Map + 全域上限）

| 欄位 | 內容 |
|------|------|
| **狀態** | `Accepted` |
| **日期** | 2026-02-20 |
| **決策者** | Project Owner |

---

## 背景（Context）

多 workspace 架構下，使用者可能同時在不同專案發送 AI 請求。每個 AI 請求 spawn 一個 Claude CLI 子進程，佔用記憶體和 CPU。需管理並行度並防止 race condition。

---

## 評估選項（Options Considered）

### 選項 A：Map-based Runner Pool + 全域上限

- **優點**：`Map<workspaceId:conversationId, RunnerState>` 精確追蹤；防止同一 conversation 重複執行；全域上限防 OOM
- **缺點**：In-memory state，server 重啟遺失（runner 被 abort）
- **風險**：上限設太小影響多 workspace 體驗

### 選項 B：Unlimited Runners

- **優點**：無等待
- **缺點**：每個 runner spawn 子進程，記憶體可能爆炸
- **風險**：OOM kill

### 選項 C：Queue 排隊（先進先出）

- **優點**：公平性
- **缺點**：延遲高；使用者等待
- **風險**：UX 差（mobile 情境需即時回應）

---

## 決策（Decision）

選擇 **選項 A**：Map-based Runner Pool。

設計：
- **Key**：`${workspaceId}:${conversationId}`
- **MAX_CONCURRENT_RUNNERS = 3**
- **Per-conversation lock**：同一 conversation 有 active runner 時拒絕新請求（"conversation is already processing"）
- **Cleanup**：WebSocket 斷線時 iterate Map，abort 該 connection 的所有 runners
- **Broadcasting**：streaming events 透過 `Set<AuthenticatedSocket>` 廣播至所有連線
- **Rate limit**：per-device sliding window 10 msg/min

---

## 後果（Consequences）

**正面影響：**
- 最多 3 個 workspace 同時執行 AI（足夠個人使用）
- 不會因 mobile 重複點擊造成 duplicate execution
- 斷線自動清理 runner（防止 orphan 進程）

**負面影響 / 技術債：**
- 超過 3 個並行請求會被拒絕（而非排隊）
- Runner state 為 in-memory（重啟遺失）

**後續追蹤：**
- [x] Map-based runner tracking
- [x] Per-conversation lock
- [x] Auto cleanup on disconnect
- [ ] 考慮加入 queue（而非直接拒絕超限請求）

---

## 關聯（Relations）

- 取代：（無）
- 被取代：（無）
- 參考：ADR-003（Claude SDK subprocess）、ADR-005（per-workspace state）、ADR-006（WebSocket streaming）
