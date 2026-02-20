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

### 已完成 — MVP + Multi-Workspace
- **AI Chat**：全螢幕對話介面，多 workspace 並行對話，自動 resume 上次對話
- **Diff Review**：file-by-file code review，approve / reject / comment
- **Quick Actions**：commit、push、pull、branch 操作
- **Multi-Workspace**：橫向 tab 切換，每個 workspace 獨立 chat / diff / git 狀態
- **Workspace Scanner**：Settings 設定 projects path，自動掃描 git repos
- **Push Notifications**：AI 完成任務時推送通知 (VAPID)
- **Token 優化**：Session Resume 降低重複 token 消耗
- **PWA**：安裝到主畫面，離線快取

### 規劃中
- 非同步任務佇列 + 看板式 UI
- GitHub/GitLab 整合
- 語音輸入 (Web Speech API)
- Multi-model 切換

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
- Anthropic API key

### Docker 啟動（推薦）

```bash
git clone https://github.com/anthropicmax/vibe-remote.git
cd vibe-remote
cp .env.example .env
# 編輯 .env 填入 ANTHROPIC_API_KEY 和 WORKSPACE_HOST_PATH

docker compose up -d
```

- Server API: `http://localhost:8080`
- Client UI: `http://localhost:8081`

### 本地啟動

```bash
git clone https://github.com/anthropicmax/vibe-remote.git
cd vibe-remote
cp .env.example .env
# 編輯 .env

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

# 測試
npm --prefix server test
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
