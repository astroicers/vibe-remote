# Architecture — Vibe Remote

## 系統全景

```
┌──────────────────────────────────────────────────────────────┐
│                        手機 (PWA)                             │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │            WorkspaceTabs (多 workspace 切換)            │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│  │ Chat UI  │ │Diff View │ │Tasks     │ │ Quick Actions │  │
│  │+ Voice   │ │+ Approve │ │(Kanban   │ │ commit/push/  │  │
│  │  Input   │ │ /Reject  │ │ 骨架)    │ │  pull/branch  │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬────────┘  │
│       │            │            │               │            │
│  ┌────▼────────────▼────────────▼───────────────▼────────┐  │
│  │              Services Layer                            │  │
│  │  api.ts (REST fetch) + websocket.ts (WS auto-reconnect)│  │
│  │  stores: chat.ts | diff.ts | workspace.ts | toast.ts  │  │
│  └──────────────────────┬────────────────────────────────┘  │
└─────────────────────────┼────────────────────────────────────┘
                          │ HTTPS + WSS
                   ┌──────┴──────┐
                   │  Tailscale  │  WireGuard encrypted tunnel
                   │  100.x.y.z  │  Zero-trust network
                   └──────┬──────┘
                          │
┌─────────────────────────┼────────────────────────────────────┐
│           Vibe Remote (Docker Compose: server + client)       │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │            API Gateway (Express.js, port 8080)         │   │
│  │  ┌─────────┐  ┌──────────┐  ┌───────────────────┐    │   │
│  │  │  JWT    │  │   CORS   │  │   Rate Limiter    │    │   │
│  │  │  Auth   │  │  Filter  │  │   (per-device)    │    │   │
│  │  └─────────┘  └──────────┘  └───────────────────┘    │   │
│  └──────────┬──────────┬──────────┬─────────────────────┘   │
│             │          │          │                           │
│  ┌──────────▼──┐ ┌─────▼─────┐ ┌─▼───────────┐              │
│  │  AI Engine  │ │ Workspace │ │ Diff Manager │              │
│  │             │ │  Manager  │ │              │              │
│  │ Claude SDK  │ │ Git Ops   │ │ Parser       │              │
│  │ Context     │ │ File Tree │ │ Reviews      │              │
│  │ Builder     │ │ Path Map  │ │ Comments     │              │
│  │ Parallel    │ │           │ │              │              │
│  │ Runners (3) │ │           │ │              │              │
│  └──────┬──────┘ └─────┬─────┘ └──────┬───────┘              │
│         │              │              │                       │
│  ┌──────▼──────────────▼──────────────▼───────────────┐      │
│  │                   SQLite Database                    │      │
│  │  conversations │ messages │ diff_reviews │ workspaces│      │
│  │  diff_comments │ devices │ push_subscriptions       │      │
│  └────────────────────────────────────────────────────┘      │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           Workspaces (File System via volume mount)    │   │
│  │  /workspace/project-a/  ← 映射自 /home/ubuntu/...     │   │
│  │  /workspace/project-b/                                │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

## 核心元件

### 1. API Gateway

Express.js HTTP server + WebSocket server 共享同一個 port。Docker 部署模式下 server (port 8080) 和 client (port 8081) 分離。

```
Docker 部署:
  server:8080
  ├── GET/POST/PATCH/DELETE /api/*  → REST endpoints
  └── WS /ws                        → WebSocket (AI streaming, tool approval)

  client:8081
  ├── Vite dev server (React PWA)
  └── Proxy /api → server:8080, /ws → server:8080
```

**Routes** (`server/src/routes/`):
```
routes/
├── index.ts          # Route aggregator
├── auth.ts           # /api/auth — JWT pairing, device management
├── workspaces.ts     # /api/workspaces — Workspace CRUD, file tree, git ops
├── chat.ts           # /api/chat — Conversation and message management
├── diff.ts           # /api/diff — Diff review and comments
├── notifications.ts  # /api/notifications — Push subscription management
├── tasks.ts          # /api/tasks — Task CRUD, run, cancel
└── templates.ts      # /api/templates — Prompt template CRUD
```

**設計決策**：
- Docker Compose 分離 server/client，方便獨立 rebuild
- Express + express-ws 處理 WebSocket
- client 透過 Vite proxy 轉發 API/WS 請求到 server

### 2. AI Engine

負責透過 Claude Agent SDK 執行 AI 任務，支援多 workspace 並行。

```
AI Engine
├── claude-sdk.ts         # Claude Agent SDK wrapper
│   ├── ClaudeSdkRunner   # 封裝 SDK query()，處理 streaming events
│   │   ├── run()         # 啟動 AI 對話（設定 cwd 為 workspace path）
│   │   ├── abort()       # 中斷執行
│   │   └── events: text | tool_use | tool_result | token_usage | error | done
│   ├── generateCommitMessage()   # 用 SDK 生成 commit message
│   └── generatePRDescription()   # 用 SDK 生成 PR description
│
├── context-builder.ts    # 組裝 AI context
│   ├── buildProjectContext()
│   │   ├── 讀 workspace 的 file tree (filtered by .gitignore, depth 2)
│   │   ├── 讀 git status + recent commits (最近 3 筆)
│   │   ├── 讀 key config files (package.json, tsconfig.json, .env.example)
│   │   └── 如果 workspace 有 system prompt，加入
│   ├── buildSystemPrompt()
│   │   └── 組裝 base prompt + project context + git info
│   └── buildFullSystemPrompt()
│       └── 附加 user-selected file contents
│
├── utils/truncate.ts     # Token 優化工具
│   ├── truncateText()        # 截斷文字
│   ├── truncateForHistory()  # 截斷單則歷史訊息
│   ├── truncateHistory()     # 截斷對話歷史列表
│   ├── checkFileSize()       # 檢查檔案大小是否超限
│   └── formatFileSize()      # 格式化檔案大小
│
└── types.ts              # AI 相關 TypeScript 類型定義
```

**並行 Runner 架構**：
- `Map<string, RunnerState>` keyed by `workspaceId:conversationId`
- `MAX_CONCURRENT_RUNNERS = 3`，防止記憶體過度消耗
- 同一 conversation 不允許同時有兩個 runner
- WS 斷線時遍歷 Map 全部 abort

**Token 優化策略**（已實作）：
- **訊息截斷**：歷史訊息限制 5 則，每則 2000 字元
- **檔案大小限制**：context files 超過 1MB 會跳過並通知使用者
- **Context Builder 優化**：file tree 深度 2 層、commits 3 筆、maxFileChars 10000

**注意**：Tool execution 由 Claude Agent SDK 內建處理，不需要自行實作 tool executor。
SDK 啟動時設定 `cwd` 為 workspace path，會自動讀取專案的 `CLAUDE.md`。
SDK 內建的 tools 包括：Read, Edit, Write, Bash, Grep, Glob 等。

**AI 互動流程（一次 chat message）**：

```
1. User sends message via WebSocket (chat_send + workspaceId)
2. chat-handler 檢查並行限制 (MAX_CONCURRENT_RUNNERS)
3. 取得/建立 conversation，驗證 workspace 存在
4. 組裝 prompt: user message + context files + history
5. 建立 ClaudeSdkRunner，設定 cwd = workspace.path
6. SDK 內部處理 tool_use loop（Read, Edit, Bash 等）
7. 所有 streaming events 帶 workspaceId 推送到 client
8. 完成後儲存 assistant message + token usage → SQLite
9. 如果有檔案被修改 → 推送 diff_ready event（含 modifiedFiles）
```

### 3. Workspace Manager

管理 server 上的所有專案目錄，支援 Docker 路徑映射。

```
Workspace Manager
├── manager.ts          # CRUD 操作
│   ├── registerWorkspace()   # 註冊目錄為 workspace（自動路徑映射）
│   ├── listWorkspaces()      # 列出所有 workspaces
│   ├── getWorkspace()        # 取得單一 workspace
│   ├── updateWorkspace()     # 更新 name / systemPrompt
│   ├── removeWorkspace()     # 移除 workspace
│   └── mapHostPathToContainer()  # Docker 路徑映射
│
├── git-ops.ts          # Git 操作 (via simple-git)
│   ├── getGitStatus()     # branch + staged/unstaged/untracked
│   ├── getGitDiff()       # unified diff（含 untracked files）
│   ├── getRecentCommits() # 最近 N 筆 commits
│   ├── getBranches()      # 列出所有 branches
│   ├── stageFiles()       # stage 指定檔案
│   ├── commitChanges()    # commit with message
│   ├── pushChanges()      # push to remote
│   ├── pullChanges()      # pull from remote
│   ├── checkoutBranch()   # switch/create branch
│   └── discardChanges()   # revert modified files
│
├── watcher.ts          # 檔案系統監控 (chokidar)
│   └── FileWatcher     # 監聽 workspace 內的檔案變更
│
└── file-tree.ts        # 檔案結構
    └── getFileTree()    # 遞迴讀取，respect .gitignore
```

**Docker 路徑映射**：
用戶在手機上輸入的是 host 路徑（如 `/home/ubuntu/myproject`），container 內的路徑不同（如 `/workspace/myproject`）。`mapHostPathToContainer()` 透過 `WORKSPACE_HOST_PATH` 和 `WORKSPACE_CONTAINER_PATH` 環境變數自動轉換。

### 4. Diff Manager

獨立的 diff review 子系統。

```
Diff Manager (server/src/diff/)
├── manager.ts          # Review CRUD 操作
│   ├── createReview()     # 從當前 git diff 建立 review
│   ├── getReview()        # 取得 review 詳情
│   ├── listReviews()      # 列出所有 reviews
│   └── updateReviewStatus()  # 更新 review 狀態
│
├── parser.ts           # Diff 解析
│   └── parseDiff()        # git diff → 結構化 FileDiff[]
│
└── types.ts            # Diff 相關類型
```

### 5. Tool Approval System

當 permission mode 非 `bypassPermissions` 時，SDK 工具需要用戶審批。

```
Tool Approval (server/src/ws/tool-approval.ts)
├── ToolApprovalStore    # In-memory pending approvals
│   ├── addPending()     # 新增待審批項目
│   ├── resolve()        # 用戶回應 (approve/reject)
│   ├── getPendingForDevice()  # 取得裝置的待審批列表
│   └── reject()         # 拒絕（含斷線時自動拒絕）
```

### 6. Task Runner (Implemented)

非同步任務執行系統。支援 AI 驅動的任務執行與 in-memory queue。

```
Task Runner (server/src/tasks/)
├── manager.ts       # Task CRUD (create/list/get/update/delete)
├── queue.ts         # In-memory TaskQueue with runner integration
├── runner.ts        # AI-powered task execution via ClaudeSdkRunner
├── index.ts         # Module exports
└── *.test.ts        # Unit tests (manager, queue, runner)
```

## 資料流

### Chat Message Flow（Multi-Workspace）

```
┌─────┐  WS: chat_send  ┌─────────┐  workspaceId  ┌──────────┐
│Phone│ + workspaceId ─→ │  Chat   │  路由到對應   │  Claude  │
│     │                  │ Handler │  Runner       │  Agent   │
│     │  WS: chunks     │         │               │   SDK    │
│     │  + workspaceId  │  並行    │  cwd =        │          │
│     │ ←────────────── │  Runner  │  workspace    │  Tool    │
│     │                  │  Map     │  .path        │  Loop    │
│     │  WS: diff_ready │  (max 3) │               │          │
│     │  + workspaceId  │         │               │          │
│     │ ←────────────── │         │               │          │
└─────┘                  └─────────┘               └──────────┘

Client 端：
  workspaceChats[wsId] ← 事件依 workspaceId 路由到正確 partition
  非當前 workspace 的 chat_complete → increment unread + toast
```

### Diff Review Flow

```
AI 修改檔案 (SDK tool_use: Write/Edit)
    │
    ▼
chat_complete 事件帶 modifiedFiles 列表
    │
    ▼
Client 可建立 review: POST /api/diff/reviews { workspaceId }
    │
    ▼
Server 執行 git diff → 解析為 per-file breakdown
    │
    ▼
User reviews file-by-file（BottomSheet 選檔案）
    │
    ├─ Approve → file 標記為 approved
    ├─ Reject  → revert 該檔案的改動
    └─ Comment → 附加到 diff_comments
    │
    ▼
All files approved?
    ├─ Yes → Approve All → 啟用 commit/push
    └─ No  → 繼續 review
```

## 部署架構

### Docker 部署（目前使用）

```yaml
# docker-compose.yml
services:
  server:
    build: ./server
    ports: ["8080:8080"]
    volumes:
      - /home/ubuntu:/workspace:rw          # 工作目錄
      - ./server/data:/app/data             # SQLite 持久化
      - ~/.claude:/home/node/.claude:rw     # Claude SDK 認證
    environment:
      - WORKSPACE_HOST_PATH=/home/ubuntu
      - WORKSPACE_CONTAINER_PATH=/workspace
      - CLAUDE_CODE_OAUTH_TOKEN=${CLAUDE_CODE_OAUTH_TOKEN}
      - CLAUDE_PERMISSION_MODE=bypassPermissions

  client:
    build: ./client
    ports: ["8081:5173"]
    environment:
      - VITE_API_URL=http://server:8080     # Vite proxy target
```

### 與 code-server 的共存

```
同一台 Server:
├── port 8080: Vibe Remote Server (API + WS)
├── port 8081: Vibe Remote Client (React PWA)
├── code-server (電腦用)
└── ~/projects/: 共享的檔案系統

兩者完全獨立運行，但操作同一個 file system。
手機上 approve 的改動，在電腦上即時可見。
同步機制 = 共享 file system + git。
```

## Client 架構

### State Management（per-workspace 分區）

```
zustand stores:
├── workspace.ts     # selectedWorkspaceId + gitStateByWorkspace
├── chat.ts          # workspaceChats: Record<string, WorkspaceChatState>
├── diff.ts          # diffByWorkspace: Record<string, WorkspaceDiffState>
├── toast.ts         # 全域 toast 通知
├── auth.ts          # JWT token + device info
├── settings.ts      # User preferences and app settings
└── tasks.ts         # Task list state per workspace
```

所有 store 的 action 接收明確 `workspaceId` 參數，不依賴隱式全域狀態。

### UI 元件階層

```
App
├── ToastContainer                        # 全域 Toast 通知
└── Routes
    ├── ChatPage / DiffPage / TasksPage / ReposPage / SettingsPage
    │   └── AppLayout                     # 統一 wrapper
    │       ├── WorkspaceTabs             # 橫向滾動 tab bar + badge
    │       ├── {children}                # 頁面內容
    │       └── BottomNav                 # 底部 5-tab 導覽
    │
    ├── ChatPage 專屬
    │   ├── ConversationSelector          # BottomSheet 切換對話
    │   ├── MessageList > MessageBubble
    │   ├── ChatInput
    │   ├── TokenUsageCard
    │   └── ToolApprovalCard
    │
    ├── DiffPage 專屬
    │   ├── FileList (BottomSheet)
    │   ├── DiffViewer (Prism 語法高亮)
    │   └── ReviewActions
    │
    └── ReposPage 專屬
        ├── Workspace 列表 + 註冊 modal
        └── QuickActions (Git 操作面板)
```

## 技術選型理由

| 選擇 | 替代方案 | 為什麼選這個 |
|-------|---------|-------------|
| Express.js | Fastify, Koa, Hono | 生態最大、AI 最熟悉、除錯容易 |
| SQLite | PostgreSQL, MongoDB | 零維護、單檔備份、個人工具夠用 |
| better-sqlite3 | sql.js, drizzle-orm | 同步 API 最簡單、效能最好 |
| React | Vue, Svelte, Solid | 生態最大、AI 產出品質最穩定 |
| Tailwind CSS | CSS Modules, styled-components | 快速迭代、不需切檔案 |
| zustand | Redux, Jotai, MobX | 最輕量、boilerplate 最少 |
| Vite | webpack, esbuild | 開發體驗最好、設定最少 |
| simple-git | nodegit, isomorphic-git | API 最直覺、維護最好 |
| zod | joi, yup, io-ts | TypeScript 原生推導、最流行 |
| Claude Agent SDK | Anthropic SDK 直接呼叫 | 內建 tool use、session 管理、permission mode |
| Docker Compose | 單一 Dockerfile | server/client 分離 rebuild，方便開發 |

## 效能考量

- **AI Response**：Claude SDK latency 約 1-3 秒首個 token，streaming 避免使用者等待
- **並行 Runner**：最多 3 個同時執行，每個 spawn 子進程，SQLite 同步序列化不衝突
- **SQLite**：開啟 WAL mode + busy_timeout 5000ms，允許讀寫並行
- **WebSocket**：自動重連策略（1s → 2s → 4s → 8s → 16s，最多 5 次）
- **Push Notification**：VAPID key pair，server 端 SQLite 儲存 subscription
- **Docker 路徑映射**：`WORKSPACE_HOST_PATH` → `WORKSPACE_CONTAINER_PATH` 避免路徑錯誤
