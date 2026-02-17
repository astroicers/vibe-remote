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
- **Runtime**: Node.js 20+ (LTS)
- **Framework**: Express.js + express-ws
- **Language**: TypeScript (strict mode)
- **Database**: SQLite via better-sqlite3 (不要用 async wrapper)
- **AI**: Anthropic SDK (`@anthropic-ai/sdk`)
- **Git**: simple-git
- **File watch**: chokidar
- **Terminal**: node-pty
- **Task queue**: BullMQ + Redis (Phase 2，MVP 先用 in-memory queue)
- **Push notifications**: web-push
- **Validation**: zod

### Client (PWA)
- **Framework**: React 18+ with TypeScript
- **Build**: Vite
- **Styling**: Tailwind CSS
- **State management**: zustand (輕量，不需要 Redux)
- **Routing**: react-router-dom v6
- **Code highlight**: Prism.js or Shiki (for diff view)
- **Diff rendering**: diff2html
- **Speech**: Web Speech API (瀏覽器原生)
- **PWA**: vite-plugin-pwa (Workbox)
- **HTTP client**: ky 或 原生 fetch
- **WebSocket**: 原生 WebSocket + 自動重連 wrapper

### 專案結構
```
vibe-remote/
├── CLAUDE.md              ← 你在這裡
├── README.md
├── docs/
│   ├── ARCHITECTURE.md
│   ├── API_SPEC.md
│   ├── DATABASE.md
│   ├── UI_UX.md
│   ├── AI_ENGINE.md
│   ├── SECURITY.md
│   ├── DEVELOPMENT.md
│   └── ROADMAP.md
├── server/
│   ├── src/
│   │   ├── index.ts           # Entry point
│   │   ├── config.ts          # 環境變數管理
│   │   ├── auth/              # JWT + QR pairing
│   │   ├── ai/                # Claude API + context + tools
│   │   ├── workspace/         # Git ops + file tree + watcher
│   │   ├── tasks/             # Task queue + runner
│   │   ├── terminal/          # PTY + command runner
│   │   ├── notifications/     # Web push
│   │   ├── routes/            # Express route handlers
│   │   ├── ws/                # WebSocket event handlers
│   │   └── db/                # SQLite schema + migrations
│   ├── package.json
│   └── tsconfig.json
├── client/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── pages/             # 5 pages: Chat, Diff, Tasks, Repos, Settings
│   │   ├── components/        # Reusable UI components
│   │   ├── hooks/             # Custom React hooks
│   │   ├── services/          # API + WebSocket clients
│   │   ├── stores/            # zustand stores
│   │   ├── types/             # Shared TypeScript types
│   │   └── manifest.json      # PWA manifest
│   ├── package.json
│   └── vite.config.ts
├── shared/                    # Server/Client 共用的 types
│   └── types.ts
├── docker-compose.yml
├── Dockerfile
└── .env.example
```

## 開發順序

嚴格按照以下順序開發，每完成一個階段要可以獨立運行：

### Phase 1.1 — 基礎骨架（先做這個）
1. 初始化 monorepo（server + client + shared）
2. Server: Express + WebSocket server 啟動
3. Client: React + Vite + Tailwind 啟動
4. 確認 `npm run dev` 可以同時啟動 server 和 client
5. 共用 types 設定好

### Phase 1.2 — Auth + Workspace
1. JWT 簽發與驗證 middleware
2. QR code pairing flow
3. Workspace CRUD API
4. File tree API
5. Git status API

### Phase 1.3 — Chat 核心
1. Claude API 串接（streaming response）
2. Context builder（讀取 workspace 檔案結構 + git info）
3. Chat REST API + WebSocket streaming
4. Chat UI（全螢幕、大輸入框、message bubbles）
5. 對話持久化（SQLite）

### Phase 1.4 — Diff Review
1. AI 修改後產生 diff 的機制
2. Diff REST API
3. Diff viewer UI（unified diff、file-by-file navigation）
4. Approve / Reject / Comment flow
5. Comment 回饋循環（送回 AI 重改）

### Phase 1.5 — Git Actions + PWA
1. Git commit / push / pull / branch APIs
2. Quick Actions UI
3. PWA manifest + service worker
4. Push notifications
5. Voice input（Web Speech API）

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

1. **Monorepo 但不用 workspace manager** — 用簡單的 `npm --prefix server` / `npm --prefix client` 就好，不需要 turborepo/nx
2. **SQLite 不是 PostgreSQL** — 這是個人工具/小團隊工具，SQLite 足夠且零維護
3. **better-sqlite3 是同步的** — 這是刻意選擇，同步 API 更簡單，SQLite 在本地磁碟上夠快
4. **MVP 不需要 Redis** — Task queue Phase 1 先用 in-memory array，Phase 2 再接 BullMQ
5. **不做 SSR** — 純 SPA，透過 Tailscale 使用，不需要 SEO
6. **WebSocket 用於 streaming** — AI 回覆和即時狀態用 WebSocket，其他都走 REST

## 常見陷阱

- ⚠️ `better-sqlite3` 是 native module，Docker 中要確保 build 環境正確
- ⚠️ Web Speech API 在 iOS Safari 和 Android Chrome 行為不同，要做 fallback
- ⚠️ PWA push notification 在 iOS 要 iOS 16.4+，需要用戶手動「加到主畫面」
- ⚠️ Claude API streaming 用 SSE 格式，要正確處理 `content_block_delta` events
- ⚠️ simple-git 的某些操作是 async 的，要小心 race condition
- ⚠️ chokidar 在某些 OS 上 CPU 使用率高，要設好 ignore patterns
