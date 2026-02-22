# [ADR-011]: In-Memory Task Queue（Phase 1）

| 欄位 | 內容 |
|------|------|
| **狀態** | `Accepted` |
| **日期** | 2026-02-19 |
| **決策者** | Project Owner |

---

## 背景（Context）

Phase 2 加入非同步任務功能：使用者建立 task → AI 背景執行 → 產生 diff review。需決定 task queue 架構。Phase 1 MVP 優先簡單可用。

---

## 評估選項（Options Considered）

### 選項 A：In-Memory Queue + SQLite CRUD

- **優點**：零外部依賴；SQLite 持久化 task 狀態；in-memory queue 處理執行順序
- **缺點**：server 重啟後 queue state 遺失（正在執行的 task 丟失）
- **風險**：single-server only

### 選項 B：BullMQ + Redis

- **優點**：分散式 queue；failure retry；job scheduling
- **缺點**：需部署 Redis；增加運維複雜度
- **風險**：過度工程化（Phase 1 用戶只有 1-2 人）

### 選項 C：Database Polling

- **優點**：用 SQLite 做 queue（poll pending tasks）
- **缺點**：polling 延遲；busy loop 浪費 CPU
- **風險**：效率差

---

## 決策（Decision）

選擇 **選項 A**：In-Memory Queue + SQLite 持久化。Phase 2 評估 BullMQ 遷移。

設計：
- **Task statuses**（9 種）：pending → queued → running → awaiting_review → approved → committed → completed / failed / cancelled
- **Priority ordering**：urgent > high > normal > low，同優先序按 `created_at` FIFO
- **Single active task**：`isProcessing` flag 確保同時只執行一個 task
- **Dependencies**：`depends_on` JSON 欄位已預留，但 Phase 1 未實作強制執行
- **Prompt Templates**：可重複使用的 prompt 模板（CRUD API + seed data）

---

## 後果（Consequences）

**正面影響：**
- 零外部依賴，部署簡單
- Task 狀態持久化（SQLite），server 重啟後可查看歷史
- Priority queue 確保重要任務優先執行

**負面影響 / 技術債：**
- 正在執行的 task 於 server 重啟後不會自動恢復
- 單進程限制（無法跨 server 共享 queue）
- Task runner 與 WebSocket streaming 整合尚未完成

**後續追蹤：**
- [x] Task CRUD API
- [x] In-memory queue + priority ordering
- [x] Prompt templates CRUD + seed data
- [ ] BullMQ + Redis 遷移（Phase 2）
- [ ] Task runner WebSocket streaming integration
- [ ] Per-task auto branch creation

---

## 關聯（Relations）

- 取代：（無）
- 被取代：（無，Phase 2 可能由 ADR-xxx Redis Queue 取代）
- 參考：ADR-002（SQLite）、ADR-003（Claude SDK runner）
