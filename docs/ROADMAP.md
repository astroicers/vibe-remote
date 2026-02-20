# Roadmap — Vibe Remote

## Phase 1 — MVP：通勤時可以 Vibe Code ✅ 完成

**目標**：能在手機上與 AI 對話、review diff、commit + push。

**狀態**：✅ 全部完成（2026-02-18）

---

### Sprint 1.1 — 基礎骨架 ✅

| Task | 狀態 |
|------|------|
| 初始化 monorepo 結構 | ✅ |
| Server: Express + WebSocket server | ✅ |
| Client: React + Vite + Tailwind | ✅ |
| Shared types 設定 | ✅ |
| SQLite 初始化 + migration runner | ✅ |
| .env + config 管理 | ✅ |
| Docker Compose（雙容器架構） | ✅ |

---

### Sprint 1.2 — Auth + Workspace ✅

| Task | 狀態 |
|------|------|
| JWT 簽發/驗證/refresh | ✅ |
| QR code pairing flow | ✅ (API 完成，前端使用 dev quick-pair) |
| Auth middleware | ✅ |
| Workspace CRUD API | ✅ |
| File tree API | ✅ |
| Git status API | ✅ |
| Client: Repos page | ✅ |
| Client: Bottom navigation（5 tabs） | ✅ |

---

### Sprint 1.3 — Chat 核心 ✅

| Task | 狀態 |
|------|------|
| Claude Agent SDK 串接 (streaming) | ✅ |
| Context builder（含 Token 優化） | ✅ |
| Session Resume 支援（DB 欄位就緒，runtime disabled） | ✅ |
| SDK 內建 tools（Read, Write, Edit, Bash, Grep, Glob） | ✅ |
| Tool approval workflow | ✅ |
| Chat WebSocket streaming | ✅ |
| 對話持久化 (SQLite) | ✅ |
| Client: Chat page | ✅ |
| Client: ChatInput | ✅ |
| Context file 選擇 | ✅ |

**Token 優化措施**：
- Session Resume（DB 欄位就緒，Docker 環境尚不穩定）
- 訊息截斷（2000 字元 / 5 條歷史）
- 檔案大小限制（1MB）
- Context Builder 精簡（深度 2、commits 3）

---

### Sprint 1.4 — Diff Review ✅

| Task | 狀態 |
|------|------|
| Diff API (get/approve/reject/approve-all) | ✅ |
| AI 修改後自動產生 diff | ✅ |
| Reject + comment → 回饋 AI | ⚠️ (Comment API 存在，回饋 AI 重改尚未串接) |
| Client: Diff page | ✅ |
| Client: File-by-file navigation | ✅ |
| Client: Approve/Reject/Comment buttons | ✅ |
| Client: Approve All | ✅ |
| Diff review 狀態持久化 | ✅ |

---

### Sprint 1.5 — Git Actions + PWA ✅

| Task | 狀態 |
|------|------|
| Git commit API | ✅ |
| Git push API | ✅ |
| Git pull API | ✅ |
| Git branch API (create/switch) | ✅ |
| Discard changes API | ✅ |
| Client: Quick Actions | ✅ |
| Client: Commit sheet | ✅ |
| PWA manifest + service worker | ✅ |
| Push notifications | ✅ |
| 連線狀態指示器 | ✅ (WS auto-reconnect，無 StatusBar UI) |

**暫緩項目**：
- Voice input (Web Speech API) — hook 已建立，完整 UX 待設計
- Create PR API — Phase 3 再處理

**已知缺口**（Phase 1 標記完成但功能不完整）：
- QR code 配對 — API 完成，前端只用 dev quick-pair，無 QR 掃碼 UI
- Diff comment → AI 回饋 — Comment 可儲存，但不會觸發 AI 重新修改
- Branch 管理 — API 存在，QuickActions 無 branch 選擇/建立 UI
- Settings 持久化 — UI 存在，大部分設定只存 localStorage
- Prompt Templates — DB table + 種子資料存在，無 API/UI
- 裝置管理 — API 存在，Settings 頁面未串接

---

### Sprint 1.6 — Multi-Workspace 並行開發 ✅

**狀態**：✅ 完成（2026-02-20）

| Task | 狀態 |
|------|------|
| Server: 並行 Runner Map（MAX_CONCURRENT_RUNNERS = 3） | ✅ |
| Server: 所有 API 加 workspaceId 參數 | ✅ |
| Server: WS 事件加 workspaceId | ✅ |
| Client: Workspace store 重構（client-side selection） | ✅ |
| Client: Chat store per-workspace partition | ✅ |
| Client: API + WebSocket service workspaceId 參數化 | ✅ |
| Client: WorkspaceTabs 元件 | ✅ |
| Client: AppLayout 包裝 | ✅ |
| Client: ConversationSelector | ✅ |
| Client: Toast 通知 | ✅ |
| Client: BottomSheet 元件 | ✅ |
| Docker Compose 雙容器部署 | ✅ |
| UI 清理：移除多餘導航按鈕 | ✅ |
| 智慧新增對話（重用空對話） | ✅ |
| 對話刪除 + 兩步驟確認 | ✅ |

**架構變更**：
- `getActiveWorkspace()` → deprecated，改用 explicit `workspaceId`
- `is_active` DB 欄位 → 歷史遺留，不再使用
- Chat handler: `Map<string, RunnerState>` keyed by `workspaceId:conversationId`
- zustand stores: `Record<string, WorkspaceState>` per-workspace 分區

---

## Phase 2 — Task Queue：非同步 Vibe Coding

**目標**：可以丟任務給 AI → AI 在背景做 → 你稍後 review。

**狀態**：📋 未開始

| Sprint | 內容 |
|--------|------|
| 2.1 | Task CRUD API + in-memory queue + 自動 branch |
| 2.2 | Task runner（AI 執行 task → 產生 diff → 更新狀態） |
| 2.3 | Task dependencies + batch create |
| 2.4 | Client: Tasks page (Kanban UI) + task create form |

**驗收場景**：
1. 早上通勤丟 3 個 tasks
2. AI 按順序/依賴執行
3. 每個 task 在獨立 branch
4. 晚上通勤 review → approve → commit
5. 回家 merge branches

---

## Phase 3 — 進階功能

**目標**：讓 Vibe Remote 成為完整的 mobile coding workflow。

| Feature | Priority | 描述 |
|---------|----------|------|
| Terminal viewer | 高 | 手機上看 terminal output（node-pty 已安裝但未使用） |
| Multi-model | 高 | Settings 可切 Sonnet/Opus（已實作，localStorage） |
| Settings 持久化 | 高 | 目前 Settings UI 存在但不持久化到後端 |
| GitHub Issues → Tasks | 中 | 從 issue 一鍵建立 task |
| CI/CD status | 中 | 顯示 GitHub Actions 狀態 |
| PR review comments sync | 中 | GitHub PR comments 同步到 chat |
| Custom system prompt per workspace | 中 | 每個專案設定不同 AI 指令（DB 欄位已存在） |
| MCP server integration | 中 | 連接你的 security MCP tools |
| Phase 4 cleanup | 中 | 移除 deprecated API（getActiveWorkspace、is_active） |
| RAG over codebase | 低 | AI 索引 codebase 做 semantic search |
| Multi-user collaboration | 低 | 兩人共用 task queue |
| Offline mode | 低 | 離線時可 queue tasks（上線後送出） |

---

## 架構決策記錄

### ✅ Claude Agent SDK（而非直接 Anthropic SDK）
- 內建 tools（Read, Write, Edit, Bash, Grep, Glob）
- 自動讀取 CLAUDE.md
- Tool use loop 自動管理
- Permission modes 支援

### ✅ Docker Compose 雙容器（而非單一容器）
- Server: Node 22-slim + better-sqlite3 build deps + Claude CLI
- Client: Node 22-slim + Vite dev server
- 各自獨立 build/deploy/scale

### ✅ Per-workspace state（而非 global state）
- zustand stores 使用 `Record<string, WorkspaceState>` pattern
- WS 事件都帶 workspaceId
- Server 支援 3 個並行 AI runner

### ❌ Serverless 不適合
**評估日期**: 2026-02-18

**原因**：
1. WebSocket 長連線 — Lambda 不支援
2. Claude SDK 對話 30s-3min — 超過 Lambda timeout
3. 本地檔案存取 — 需要 workspace 的 git/file 操作
4. SQLite — 需要持久磁碟

**結論**：維持 VPS + Tailscale 架構

---

## Dogfooding 策略

### 里程碑 1：Chat + Diff ✅
```
通勤時用手機 chat → review → （回家 commit）
```

### 里程碑 2：Git Actions ✅
```
完整的通勤 coding flow：chat → diff → approve → commit → push
```

### 里程碑 3：Multi-Workspace ✅
```
同時操作多個專案，背景並行 AI 處理
```

### 里程碑 4：Task Queue（Phase 2 完成後）
```
非同步工作流：睡前丟 tasks → 早上通勤 review
```

## 成功指標

| 指標 | MVP 目標 | Phase 2 目標 |
|------|---------|-------------|
| 每日手機 coding 時間 | 30 min | 60 min |
| 手機 → commit 平均時間 | < 10 min | < 5 min |
| AI 修改 first-time approve rate | 60% | 80% |
| 通勤利用率 | 50% | 80% |
| 每週手機 commits | 5 | 15 |
