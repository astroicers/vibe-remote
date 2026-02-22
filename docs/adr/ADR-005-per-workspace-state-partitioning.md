# [ADR-005]: Per-Workspace 狀態分區架構

| 欄位 | 內容 |
|------|------|
| **狀態** | `Accepted` |
| **日期** | 2026-02-20 |
| **決策者** | Project Owner |

---

## 背景（Context）

Vibe Remote 支援同時管理多個 workspace（專案），使用者可隨時切換。需要確保每個 workspace 的 chat、diff、tasks、git status 狀態互不干擾，且切換時不遺失進行中的資料。

---

## 評估選項（Options Considered）

### 選項 A：Per-Workspace Record Partitioning（`Record<workspaceId, State>`）

- **優點**：切換 workspace 時狀態不遺失；所有 action 明確帶 `workspaceId` 參數，無隱含狀態
- **缺點**：Store 程式碼較冗長（需 helper 函式更新巢狀 state）
- **風險**：記憶體佔用隨 workspace 數量增長

### 選項 B：Single Active State + 切換時清空重載

- **優點**：Store 結構簡單
- **缺點**：切換 workspace 會遺失正在串流的 AI 回應；需要重新 fetch 所有資料
- **風險**：UX 極差（串流中斷）

### 選項 C：獨立 Store Instance Per Workspace

- **優點**：完全隔離
- **缺點**：React Context 需動態建立；store instance 管理複雜
- **風險**：記憶體洩漏（無法自動清理）

---

## 決策（Decision）

選擇 **選項 A**：所有 Zustand store 使用 `Record<string, WorkspaceState>` 模式。

實作模式：
- `chat.ts`：`workspaceChats: Record<string, WorkspaceChatState>`
- `diff.ts`：`diffByWorkspace: Record<string, WorkspaceDiffState>`
- `workspace.ts`：`gitStateByWorkspace: Record<string, GitState>`
- `tasks.ts`：`tasksByWorkspace: Record<string, WorkspaceTaskState>`
- 每個 store 提供 `updateWorkspaceXxx(state, workspaceId, updater)` helper 做 immutable update
- 跨 store 取得當前 workspace：`useWorkspaceStore.getState().selectedWorkspaceId`

---

## 後果（Consequences）

**正面影響：**
- 切換 workspace 瞬間完成（零延遲，狀態已在記憶體）
- AI 串流不中斷（背景 workspace 繼續接收 WebSocket events）
- 支援 unread badge 計算（背景 workspace 的新訊息）

**負面影響 / 技術債：**
- Store 程式碼冗長（每個 action 需要 workspaceId 參數）
- 跨 store 引用（`useWorkspaceStore.getState()` in chat store）增加耦合

**後續追蹤：**
- [x] 7 個 store 全部改為 per-workspace partitioning
- [x] WorkspaceTabs 顯示 unread badge + streaming indicator
- [ ] 評估記憶體清理機制（長時間未使用的 workspace state）

---

## 關聯（Relations）

- 取代：（無）
- 被取代：（無）
- 參考：ADR-006（WebSocket 事件路由至正確 workspace）
