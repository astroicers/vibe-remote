# Roadmap — Vibe Remote

## Phase 1 -- MVP: Vibe Code during commute [done]

**Goal**: chat with AI on mobile, review diff, commit + push.

**Status**: [done] All completed (2026-02-18)

---

### Sprint 1.1 -- Foundation [done]

| Task | Status |
|------|--------|
| Initialize monorepo structure | [done] |
| Server: Express + WebSocket server | [done] |
| Client: React + Vite + Tailwind | [done] |
| Shared types setup | [done] |
| SQLite init + migration runner | [done] |
| .env + config management | [done] |
| Docker Compose (dual-container) | [done] |

---

### Sprint 1.2 -- Auth + Workspace [done]

| Task | Status |
|------|--------|
| JWT issue/verify/refresh | [done] |
| QR code pairing flow | [done] (API complete, frontend uses dev quick-pair) |
| Auth middleware | [done] |
| Workspace CRUD API | [done] |
| File tree API | [done] |
| Git status API | [done] |
| Client: Repos page | [done] |
| Client: Bottom navigation (5 tabs) | [done] |

---

### Sprint 1.3 -- Chat Core [done]

| Task | Status |
|------|--------|
| Claude Agent SDK integration (streaming) | [done] |
| Context builder (with token optimization) | [done] |
| Session Resume support (DB fields ready, runtime disabled) | [done] |
| SDK built-in tools (Read, Write, Edit, Bash, Grep, Glob) | [done] |
| Tool approval workflow | [done] |
| Chat WebSocket streaming | [done] |
| Conversation persistence (SQLite) | [done] |
| Client: Chat page | [done] |
| Client: ChatInput | [done] |
| Context file selection | [done] |

**Token optimization measures**:
- Session Resume（DB 欄位就緒，Docker 環境尚不穩定）
- 訊息截斷（2000 字元 / 5 條歷史）
- 檔案大小限制（1MB）
- Context Builder 精簡（深度 2、commits 3）

---

### Sprint 1.4 -- Diff Review [done]

| Task | Status |
|------|--------|
| Diff API (get/approve/reject/approve-all) | [done] |
| Auto-generate diff after AI edits | [done] |
| Reject + comment -> feedback to AI | NOTE: Comment API exists, AI re-edit feedback not yet wired |
| Client: Diff page | [done] |
| Client: File-by-file navigation | [done] |
| Client: Approve/Reject/Comment buttons | [done] |
| Client: Approve All | [done] |
| Diff review state persistence | [done] |

---

### Sprint 1.5 -- Git Actions + PWA [done]

| Task | Status |
|------|--------|
| Git commit API | [done] |
| Git push API | [done] |
| Git pull API | [done] |
| Git branch API (create/switch) | [done] |
| Discard changes API | [done] |
| Client: Quick Actions | [done] |
| Client: Commit sheet | [done] |
| PWA manifest + service worker | [done] |
| Push notifications | [done] |
| Connection status indicator | [done] (WS auto-reconnect, no StatusBar UI) |

**Deferred items**:
- Voice input (Web Speech API) — hook 已建立，完整 UX 待設計
- Create PR API — Phase 3 再處理

**Known gaps** (Phase 1 marked complete but functionality incomplete):
- QR code pairing -- API complete, frontend only uses dev quick-pair, no QR scan UI
- ~~Diff comment -> AI feedback~~ -- [fixed] SPEC-003 實作 diff comment → AI feedback loop
- Branch management -- API exists, QuickActions lacks branch selection/creation UI
- Settings persistence -- UI exists, most settings only stored in localStorage
- Device management -- API exists, Settings page not wired up

---

### Sprint 1.6 -- Multi-Workspace Parallel Development [done]

**Status**: [done] Completed (2026-02-20)

| Task | Status |
|------|--------|
| Server: parallel Runner Map (MAX_CONCURRENT_RUNNERS = 3) | [done] |
| Server: all APIs accept workspaceId param | [done] |
| Server: WS events carry workspaceId | [done] |
| Client: Workspace store refactor (client-side selection) | [done] |
| Client: Chat store per-workspace partition | [done] |
| Client: API + WebSocket service workspaceId parameterized | [done] |
| Client: WorkspaceTabs component | [done] |
| Client: AppLayout wrapper | [done] |
| Client: ConversationSelector | [done] |
| Client: Toast notifications | [done] |
| Client: BottomSheet component | [done] |
| Docker Compose dual-container deployment | [done] |
| UI cleanup: remove redundant navigation buttons | [done] |
| Smart new conversation (reuse empty conversations) | [done] |
| Conversation delete + two-step confirmation | [done] |

**架構變更**：
- `getActiveWorkspace()` → deprecated，改用 explicit `workspaceId`
- `is_active` DB 欄位 → 歷史遺留，不再使用
- Chat handler: `Map<string, RunnerState>` keyed by `workspaceId:conversationId`
- zustand stores: `Record<string, WorkspaceState>` per-workspace 分區

---

### Bug Fixes & Stability (2026-02-22) [done]

| Fix | SPEC | ADR | Status |
|-----|------|-----|--------|
| 訊息去重：修復 React StrictMode 導致 WS handler 重複註冊，訊息顯示兩次 | SPEC-008 | ADR-017 | [done] |
| Runner Timeout + Abort：為 AI runner 加入超時機制 (10min) 和手動中止能力 | SPEC-009 | ADR-018 | [done] |
| Tool Approval SDK 接通：將既有 Tool Approval 基礎設施與 SDK `canUseTool` callback 連接 | SPEC-010 | ADR-019 | [done] |

---

## Phase 2 -- Task Queue: Async Vibe Coding

**Goal**: queue tasks for AI -> AI works in background -> you review later.

**Status**: Partially implemented

### Completed

| Item | SPEC | Status |
|------|------|--------|
| Task CRUD API (`server/src/routes/tasks.ts`) | — (Phase 1 MVP) | [done] |
| In-memory TaskQueue (`server/src/tasks/queue.ts`) | — (Phase 1 MVP) | [done] |
| ClaudeSdkRunner runner (`server/src/tasks/runner.ts`) | — (Phase 1 MVP) | [done] |
| Client: TaskCard, KanbanColumn, TaskCreateSheet | — (Phase 1 MVP) | [done] |
| Prompt Templates API (`server/src/routes/templates.ts`) | — (Phase 1 MVP) | [done] |
| Task auto branch creation | SPEC-001 | [done] |
| Task dependencies | SPEC-002 | [done] |
| Task runner WS streaming | SPEC-004 | [done] |
| Multi-model settings | SPEC-005 | [done] |
| Settings persistence (server-side) | SPEC-006 | [done] |
| Task status WebSocket client wiring | SPEC-007 | [done] |

### Enhancements (2026-02-25)

| Item | SPEC | Status |
|------|------|--------|
| Recursive workspace scan (depth up to 5) | SPEC-011 | [done] |
| Env config expansion (8 new configurable params) | SPEC-012 | [done] |

### Remaining
- Batch task creation（SPEC-002 有部分基礎，完整 UI 待實作）
- BullMQ + Redis migration（deferred to later phase）

| Sprint | Content | Status |
|--------|---------|--------|
| 2.1 | Task CRUD API + in-memory queue + auto branch | [done] SPEC-001 |
| 2.2 | Task runner (AI executes task -> generates diff -> updates status) | [done] SPEC-004 |
| 2.3 | Task dependencies + batch create | [partial] SPEC-002 (deps done, batch UI pending) |
| 2.4 | Client: Tasks page (Kanban UI) + task create form + WS status | [done] SPEC-007 |

**Acceptance scenario**:
1. Queue 3 tasks during morning commute
2. AI executes in order/dependency
3. Each task on independent branch
4. Review during evening commute -> approve -> commit
5. Merge branches at home

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

### [adopted] Claude Agent SDK (instead of direct Anthropic SDK)
- 內建 tools（Read, Write, Edit, Bash, Grep, Glob）
- 自動讀取 CLAUDE.md
- Tool use loop 自動管理
- Permission modes 支援

### [adopted] Docker Compose dual-container (instead of single container)
- Server: Node 22-slim + better-sqlite3 build deps + Claude CLI
- Client: Node 22-slim + Vite dev server
- 各自獨立 build/deploy/scale

### [adopted] Per-workspace state (instead of global state)
- zustand stores 使用 `Record<string, WorkspaceState>` pattern
- WS 事件都帶 workspaceId
- Server 支援 3 個並行 AI runner

### [rejected] Serverless is not suitable
**評估日期**: 2026-02-18

**原因**：
1. WebSocket 長連線 — Lambda 不支援
2. Claude SDK 對話 30s-3min — 超過 Lambda timeout
3. 本地檔案存取 — 需要 workspace 的 git/file 操作
4. SQLite — 需要持久磁碟

**結論**：維持 VPS + Tailscale 架構

---

## Dogfooding 策略

### Milestone 1: Chat + Diff [done]
```
通勤時用手機 chat → review → （回家 commit）
```

### Milestone 2: Git Actions [done]
```
完整的通勤 coding flow：chat → diff → approve → commit → push
```

### Milestone 3: Multi-Workspace [done]
```
同時操作多個專案，背景並行 AI 處理
```

### Milestone 4: Task Queue (after Phase 2 completion)
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
