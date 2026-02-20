# CLAUDE.md — Vibe Remote 開發指引

## 專案概述

Vibe Remote 是一個 mobile-first PWA，讓工程師在通勤時用手機透過自然語言（語音 + 文字）驅動 AI 完成 coding 任務。它不是 mobile IDE，而是一個「對話 → review diff → approve → commit」的操作介面。

## 文件地圖

開發前請依序閱讀以下文件：

| 文件 | 用途 | 優先序 |
|------|------|--------|
| `docs/ARCHITECTURE.md` | 系統架構、元件關係、技術選型 | 🔴 必讀 |
| `docs/API_SPEC.md` | 完整 REST + WebSocket API 規格 | 🔴 必讀 |
| `docs/DATABASE.md` | SQLite schema、資料模型 | 🔴 必讀 |
| `docs/UI_UX.md` | Mobile UI 設計、元件階層 | 🟡 開發前端時必讀 |
| `docs/AI_ENGINE.md` | AI context building、tool use | 🟡 開發 AI 模組時必讀 |
| `docs/SECURITY.md` | 認證、授權、安全設計 | 🟡 開發 auth 時必讀 |
| `docs/DEVELOPMENT.md` | 開發環境、coding standards | 🟢 參考 |
| `docs/ROADMAP.md` | 開發階段與驗收標準 | 🟢 參考 |

## 技術棧

### Server
- **Runtime**: Node.js 22 (Docker) / 20+ (本地)
- **Framework**: Express.js + express-ws
- **Language**: TypeScript (strict mode, `moduleResolution: bundler`)
- **Database**: SQLite via better-sqlite3 (同步 API，不要用 async wrapper)
- **AI**: Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) — 透過 Claude Code CLI 子進程執行
- **Git**: simple-git
- **Push notifications**: web-push
- **Validation**: zod
- **Dev**: tsx (TypeScript runner), vitest (testing)

### Client (PWA)
- **Framework**: React 19 with TypeScript
- **Build**: Vite 6
- **Styling**: Tailwind CSS 4
- **State management**: zustand
- **Routing**: react-router-dom v7
- **PWA**: vite-plugin-pwa (Workbox)
- **HTTP client**: 原生 fetch (封裝在 `services/api.ts`)
- **WebSocket**: 原生 WebSocket + 自動重連 wrapper

### 專案結構
```
vibe-remote/
├── CLAUDE.md              ← 你在這裡
├── README.md
├── package.json           # 根 monorepo scripts (concurrently)
├── docker-compose.yml     # server:8080, client:8081
├── .env.example
├── shared/
│   └── types.ts           # Server/Client 共用 types
├── docs/                  # 8 份設計文件
├── server/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   └── src/
│       ├── index.ts           # Entry: Express + WS server
│       ├── config.ts          # 環境變數 (dotenv)
│       ├── auth/              # JWT + QR pairing + middleware
│       ├── ai/                # Claude SDK runner + context builder
│       │   ├── claude-sdk.ts  # ClaudeSdkRunner (Agent SDK wrapper)
│       │   └── context-builder.ts
│       ├── workspace/         # Git ops + file tree + manager
│       │   ├── manager.ts     # Workspace CRUD + 路徑掃描
│       │   ├── git-ops.ts     # simple-git wrapper
│       │   └── file-tree.ts   # 遞迴目錄讀取
│       ├── diff/              # Diff parsing + review manager
│       ├── notifications/     # Web push (VAPID)
│       ├── routes/            # REST API handlers
│       │   ├── auth.ts
│       │   ├── chat.ts
│       │   ├── diff.ts
│       │   ├── workspaces.ts  # 含 GET /scan 端點
│       │   └── notifications.ts
│       ├── ws/                # WebSocket handlers
│       │   ├── chat-handler.ts  # 並行 runner Map (per workspace:conversation)
│       │   ├── tool-approval.ts
│       │   └── rate-limit.ts
│       ├── db/                # SQLite schema + migrations
│       └── utils/             # truncate 等工具
├── client/
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.ts     # proxy → localhost:8080, PWA config
│   ├── tsconfig.json
│   └── src/
│       ├── App.tsx            # Router + AppLayout
│       ├── main.tsx           # Entry point
│       ├── pages/
│       │   ├── ChatPage.tsx      # AI 對話
│       │   ├── DiffPage.tsx      # Diff Review
│       │   ├── ReposPage.tsx     # Workspace 管理 + 自動掃描
│       │   ├── SettingsPage.tsx  # Projects path + push notifications
│       │   └── TasksPage.tsx     # 任務列表（Phase 2）
│       ├── components/
│       │   ├── AppLayout.tsx         # App shell + WorkspaceTabs
│       │   ├── WorkspaceTabs.tsx     # 橫向滾動 workspace tabs
│       │   ├── BottomNav.tsx         # 底部導覽列
│       │   ├── BottomSheet.tsx       # 通用底部彈出選單
│       │   ├── ConversationSelector.tsx  # 對話切換
│       │   ├── Toast.tsx             # Toast 通知
│       │   ├── chat/                 # ChatInput, MessageBubble, MessageList, etc.
│       │   ├── diff/                 # DiffViewer, FileList, ReviewActions
│       │   └── actions/              # QuickActions, GitStatusCard, ActionButton
│       ├── hooks/
│       │   ├── usePushNotifications.ts
│       │   └── useSpeech.ts
│       ├── services/
│       │   ├── api.ts           # REST API client (fetch wrapper)
│       │   ├── websocket.ts     # WS client + auto-reconnect
│       │   ├── push.ts          # Push notification helpers
│       │   └── speech.ts        # Web Speech API wrapper
│       ├── stores/              # zustand stores
│       │   ├── workspace.ts     # 多 workspace 選擇 + git state
│       │   ├── chat.ts          # Per-workspace chat partition
│       │   ├── diff.ts          # Per-workspace diff state
│       │   ├── auth.ts          # Auth token 管理
│       │   └── toast.ts         # Toast 通知
│       ├── styles/
│       │   └── globals.css      # Tailwind imports + custom styles
│       └── types/               # Client-side types
└── design/                # Penbook 設計稿
```

## 核心架構特性

### Multi-Workspace 並行開發
- **Server**: `chat-handler.ts` 使用 `Map<string, RunnerState>` 支援最多 3 個並行 AI runner
- **Client**: 所有 store 使用 `Record<string, WorkspaceState>` 按 workspace 分區
- **WebSocket**: 所有事件攜帶 `workspaceId` 路由到正確分區
- **UI**: WorkspaceTabs 支援 tab 切換、未讀紅點、processing indicator

### AI Engine
- 使用 **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`)，非直接 API 呼叫
- Agent SDK 需要系統安裝 `@anthropic-ai/claude-code` CLI
- 支援 Session Resume（`sdk_session_id` 儲存於 DB）降低 token 消耗
- 內建工具：Read, Write, Edit, Bash, Grep, Glob
- Context Builder 自動注入 workspace 的 file tree + git status + system prompt

### Docker 雙容器架構
- **server** container (port 8080): Express API + WebSocket + Claude CLI
- **client** container (port 8081): Vite dev server (proxy → server)
- Workspace 目錄透過 volume mount 共享 (`WORKSPACE_HOST_PATH` → `/workspace`)

## Coding Standards

### TypeScript
- `strict: true` 在所有 tsconfig
- 永遠用 `interface` 而非 `type` 來定義物件形狀（除非需要 union type）
- 所有 API request/response 用 zod schema 驗證
- 不要用 `any`，用 `unknown` + type guard

### 命名規則
- 檔案：kebab-case (`context-builder.ts`)
- Component：PascalCase (`ChatInput.tsx`)
- 函式/變數：camelCase
- 常數：UPPER_SNAKE_CASE
- Database columns：snake_case

### Error Handling
- Server: 統一 error response format `{ error: string, code: string, details?: unknown }`
- Client: 全域 error boundary + toast notification
- 永遠 catch async errors，不要讓 promise 靜默失敗

### Git Conventions
- Commit message: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`)
- Branch: `feat/xxx`, `fix/xxx`, `chore/xxx`

## 關鍵設計決策

1. **Monorepo 但不用 workspace manager** — 用 `npm --prefix server` / `npm --prefix client` + root `concurrently`
2. **SQLite 不是 PostgreSQL** — 個人工具/小團隊工具，SQLite 足夠且零維護
3. **better-sqlite3 是同步的** — 刻意選擇，同步 API 更簡單，SQLite 本地磁碟夠快
4. **Claude Agent SDK 而非直接 API** — 內建工具（file ops, git, bash）+ session resume
5. **不做 SSR** — 純 SPA，透過 Tailscale 存取，不需要 SEO
6. **WebSocket 用於 streaming** — AI 回覆和即時狀態用 WebSocket，CRUD 走 REST
7. **Per-workspace state partitioning** — Client stores 使用 `Record<workspaceId, State>` 支援並行

## 常見陷阱

- ⚠️ `better-sqlite3` 是 native module，Docker 需要 python3 + make + g++ build 環境
- ⚠️ Claude Agent SDK 需要 `@anthropic-ai/claude-code` CLI 全域安裝
- ⚠️ Claude CLI 以 root 執行會拒絕 `--dangerously-skip-permissions`，Docker 中用 `node` user
- ⚠️ PWA push notification 在 iOS 要 iOS 16.4+，需要用戶手動「加到主畫面」
- ⚠️ Docker workspace 路徑映射：host path ≠ container path，用 `WORKSPACE_HOST_PATH` / `WORKSPACE_CONTAINER_PATH` 設定
- ⚠️ 同一 conversation 不允許兩個 runner 同時執行（Map key 檢查防 race condition）
- ⚠️ `MAX_CONCURRENT_RUNNERS = 3` 限制並行 AI 處理，每個 runner spawn 子進程消耗記憶體
