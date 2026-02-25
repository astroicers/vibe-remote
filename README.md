# Vibe Remote

**Mobile-first agentic coding gateway** — 在通勤時用手機 vibe coding。

## 這是什麼？

Vibe Remote 讓你在手機上透過自然語言（語音 + 文字）驅動 AI 完成 coding 任務。它不是把 IDE 搬到手機上，而是專門為「對話 → review diff → approve → commit」的工作流程設計的 mobile-first 介面。

### 典型使用場景

```
通勤中
  ├─ 語音告訴 AI：「幫 auth service 加上 rate limiting middleware」
  ├─ AI 在背景工作（多專案可同時處理）
  ├─ 收到 push notification → 滑動瀏覽 diff → approve
  └─ 一鍵 commit + push

回到電腦
  ├─ git pull → 所有手機上 approve 的改動都在
  └─ 用 VSCode + Claude Code 繼續精修
```

## 架構

```
手機 (PWA) ←──HTTPS──→ Tailscale ←──→ VPS / 你的 Server
                                        ├── Vibe Remote API (Express + WS)
                                        ├── AI Engine (Claude Agent SDK)
                                        ├── Workspace Manager (multi-workspace)
                                        └── ~/projects/* (volume mount)
```

## 功能

### Completed -- MVP + Multi-Workspace + Task Queue
- **AI Chat**: full-screen conversation UI, multi-workspace parallel chat, auto-resume last conversation
- **Diff Review**: file-by-file code review, approve / reject / comment
- **Quick Actions**: commit, push, pull, branch operations
- **Multi-Workspace**: horizontal tab switching, per-workspace independent chat / diff / git state
- **Workspace Scanner**: Settings to configure projects path, auto-scan git repos
- **Push Notifications**: push notification on AI task completion (VAPID)
- **Token Optimization**: Session Resume to reduce redundant token usage
- **PWA**: install to home screen, offline cache
- **Task Queue + Kanban UI**: async task queue with kanban board, task CRUD, in-memory queue, AI runner
- **Prompt Templates**: template API with seed data for common coding tasks

### Planned
- GitHub/GitLab integration
- Voice input (Web Speech API)
- Multi-model switching

## 技術棧

| Layer | Tech |
|-------|------|
| Server | Node.js 22 + Express + TypeScript |
| Database | SQLite (better-sqlite3, 同步 API) |
| AI | Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) |
| Client | React 19 + Vite 6 + Tailwind CSS 4 |
| State | zustand (per-workspace partitioned) |
| PWA | vite-plugin-pwa (Workbox) |
| Network | Tailscale (WireGuard) |
| Git | simple-git |
| Push | web-push (VAPID) |

## 快速開始

### 前置需求
- Node.js 20+
- Docker + Docker Compose (推薦)
- Tailscale 已安裝並登入
- Claude 認證（擇一，詳見下方）

### Claude 認證設定

Vibe Remote 使用 [Claude Agent SDK](https://docs.anthropic.com/en/docs/claude-code/sdk) 驅動 AI，需要以下任一認證方式：

**方法 A：OAuth Token（推薦，使用 Max/Pro 訂閱額度）**

```bash
# 1. 安裝 Claude Code CLI
npm install -g @anthropic-ai/claude-code

# 2. 產生 OAuth Token（瀏覽器會開啟認證頁面）
claude setup-token
# 完成後取得 sk-ant-oat01-... 格式的 token

# 3. 寫入 .env
CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat01-你的token
```

**方法 B：Anthropic API Key（按用量付費）**

```bash
# 1. 前往 https://console.anthropic.com/keys 建立 API Key
# 2. 寫入 .env
ANTHROPIC_API_KEY=sk-ant-api03-你的key
```

### Docker 啟動（推薦）

```bash
git clone https://github.com/astroicers/vibe-remote.git
cd vibe-remote
cp .env.example .env
# 編輯 .env：填入 Claude 認證 token（見上方說明）、JWT_SECRET、WORKSPACE_HOST_PATH

docker compose up -d
```

- Server API: `http://localhost:8080`
- Client UI: `http://localhost:8081`

### 本地啟動

```bash
git clone https://github.com/astroicers/vibe-remote.git
cd vibe-remote
cp .env.example .env
# 編輯 .env（見上方 Claude 認證設定）

# 安裝依賴
npm install
npm --prefix server install
npm --prefix client install

# 同時啟動 server + client
npm run dev
```

- Server: `http://localhost:8080`
- Client: `http://localhost:5173` (Vite dev server, proxy → 8080)

### 手機連線
1. 確保手機和 server 都在 Tailscale 網路中
2. 打開 `http://YOUR_TAILSCALE_IP:8081`（Docker）或 `:5173`（本地）
3. 首次使用：Settings → Quick Pair（dev mode）或 QR code pairing
4. Safari/Chrome → 「加到主畫面」安裝 PWA

## 開發

```bash
# 同時啟動 server + client (dev mode)
npm run dev

# 單獨啟動
npm --prefix server run dev
npm --prefix client run dev

# Type check
npm --prefix server run typecheck
npm --prefix client run typecheck

# Tests
npm --prefix server test
npm --prefix client test
```

### Docker 開發

```bash
# 啟動
docker compose up -d

# 查看日誌
docker compose logs -f server
docker compose logs -f client

# 重建
docker compose up -d --build
```

## 文件

| 文件 | 內容 |
|------|------|
| `CLAUDE.md` | AI 開發指引、技術棧、專案結構 |
| `docs/ARCHITECTURE.md` | 系統架構、元件關係 |
| `docs/API_SPEC.md` | REST + WebSocket API 規格 |
| `docs/DATABASE.md` | SQLite schema、資料模型 |
| `docs/UI_UX.md` | Mobile UI 設計 |
| `docs/AI_ENGINE.md` | AI context building |
| `docs/SECURITY.md` | 認證、授權 |
| `docs/DEVELOPMENT.md` | 開發環境設定 |
| `docs/ROADMAP.md` | 開發階段規劃 |

## License

MIT
