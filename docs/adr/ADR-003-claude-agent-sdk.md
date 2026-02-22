# [ADR-003]: 使用 Claude Agent SDK 而非直接 API 呼叫

| 欄位 | 內容 |
|------|------|
| **狀態** | `Accepted` |
| **日期** | 2026-02-18 |
| **決策者** | Project Owner |

---

## 背景（Context）

AI Engine 是本專案核心。需要 AI 能讀寫檔案、執行 bash 指令、搜尋 codebase、串流回應。需決定使用 Claude API 直接呼叫還是透過 Agent SDK。

---

## 評估選項（Options Considered）

### 選項 A：Claude Agent SDK（`@anthropic-ai/claude-agent-sdk`）

- **優點**：內建工具（Read, Write, Edit, Bash, Grep, Glob）無需重新實作；自動讀取專案 CLAUDE.md；支援 session resume 降低 token 消耗；支援 streaming events
- **缺點**：需全域安裝 `@anthropic-ai/claude-code` CLI；每次呼叫 spawn 子進程（較慢）
- **風險**：SDK 版本更新可能 breaking；Docker 中 session resume 不穩定

### 選項 B：直接 Claude API（Anthropic SDK）

- **優點**：完全控制 prompt/response；無子進程 overhead
- **缺點**：需自行實作所有工具（file ops、git、bash）；token context 管理複雜
- **風險**：工具實作安全性問題（command injection 等）

### 選項 C：LangChain / LlamaIndex

- **優點**：抽象層支援多模型切換
- **缺點**：不支援 Claude 原生工具；增加大量依賴
- **風險**：抽象泄漏、除錯困難

---

## 決策（Decision）

選擇 **選項 A**：Claude Agent SDK。

關鍵設計：
- `ClaudeSdkRunner` 繼承 `EventEmitter`，emit streaming events（text、tool_use、tool_result、token_usage、error、done）
- 三種認證方式按優先序：OAuth Token → API Key → CLI Session
- Permission mode 預設 `bypassPermissions`（mobile 情境需 AI 自主執行，使用者在 diff review 階段審核）
- `maxTurns: 20` 防止無限循環
- Session resume 目前停用（Docker 中跨進程找不到 session 檔案），改用 inline history

---

## 後果（Consequences）

**正面影響：**
- 省去數千行工具實作程式碼
- AI 自動獲得專案 CLAUDE.md context
- Streaming events 提供即時 UX 回饋

**負面影響 / 技術債：**
- 每次 AI 呼叫 spawn 子進程（約 200ms overhead）
- Session resume 停用導致 token 消耗較高（每次送 inline history）
- Claude CLI 需在 Docker 中全域安裝

**後續追蹤：**
- [x] EventEmitter 架構解耦 SDK 與 WebSocket
- [x] Token usage tracking 儲存至 DB
- [ ] 待 SDK 修復 Docker session resume 後重新啟用
- [ ] 評估 per-workspace model 切換 API 持久化

---

## 關聯（Relations）

- 取代：（無）
- 被取代：（無）
- 參考：ADR-001、ADR-006
