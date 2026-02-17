# Vibe Remote 🎤📱

**Mobile-first agentic coding gateway** — 在通勤時用手機 vibe coding。

## 這是什麼？

Vibe Remote 讓你在手機上透過自然語言（語音 + 文字）驅動 AI 完成 coding 任務。它不是把 IDE 搬到手機上，而是專門為「對話 → review diff → approve → commit」的工作流程設計的 mobile-first 介面。

### 典型使用場景

```
🚇 早上通勤
  ├─ 語音告訴 AI：「幫 auth service 加上 rate limiting middleware」
  ├─ AI 在背景工作
  ├─ 收到通知 → 滑動瀏覽 diff → approve
  └─ 一鍵 commit + push

💻 回到電腦
  ├─ git pull → 所有手機上 approve 的改動都在
  └─ 用 VSCode + Claude Code 繼續精修
```

## 架構

```
手機 (PWA) ←──HTTPS──→ Tailscale ←──→ 你的 Server
                                        ├── Vibe Remote API
                                        ├── AI Engine (Claude)
                                        ├── Workspace Manager
                                        └── ~/projects/*
```

- **Vibe Remote PWA**：手機上的 mobile-first 介面
- **code-server**：電腦上的完整 IDE（已存在的方案）
- 兩者共享同一台 server、同一個檔案系統、同一個 Tailscale 網路
- 改動即時同步，無需額外設定

## 功能

### Phase 1 — MVP
- 💬 **AI Chat**：全螢幕對話介面，支援語音輸入（中英文）
- 📝 **Diff Review**：滑動式 file-by-file code review，approve/reject/comment
- ⚡ **Quick Actions**：一鍵 commit、push、test、lint、create PR
- 📁 **Workspace**：多專案切換，file tree 瀏覽
- 🔔 **Push Notifications**：AI 完成任務時推送通知

### Phase 2 — Task Queue
- 📋 非同步任務佇列：丟任務給 AI → 背景執行 → 通知你 review
- 🔗 Task 依賴關係：Task B 等 Task A 完成再開始
- 📋 看板式 UI

### Phase 3 — 進階
- Multi-repo 支援
- GitHub/GitLab 整合
- MCP server 整合
- Multi-model 切換

## 快速開始

### 前置需求
- Node.js 20+
- Tailscale 已安裝並登入
- Anthropic API key

### 安裝
```bash
git clone https://github.com/YOUR_USERNAME/vibe-remote.git
cd vibe-remote
cp .env.example .env
# 編輯 .env 填入 ANTHROPIC_API_KEY

# Server
cd server && npm install && cd ..

# Client
cd client && npm install && cd ..

# 啟動
npm run dev
```

### 手機連線
1. 確保手機和 server 都在 Tailscale 網路中
2. 打開 `https://YOUR_TAILSCALE_IP:3000`
3. 首次使用在電腦端產生 QR code → 手機掃碼
4. Safari/Chrome → 「加到主畫面」

## 技術棧

| Layer | Tech |
|-------|------|
| Server | Node.js + Express + TypeScript |
| Database | SQLite (better-sqlite3) |
| AI | Anthropic Claude API |
| Client | React + Vite + Tailwind CSS |
| PWA | Workbox (vite-plugin-pwa) |
| Network | Tailscale (WireGuard) |
| Git | simple-git |

## 開發

```bash
# 同時啟動 server + client (dev mode)
npm run dev

# 單獨啟動
npm --prefix server run dev
npm --prefix client run dev

# Type check
npm run typecheck

# Lint
npm run lint
```

## License

MIT

## 為什麼做這個？

身為一個每天通勤的工程師，我希望能善用捷運上的時間做開發。但在手機上用 code-server 的體驗很差——螢幕太小、觸控操作痛苦、Claude Code extension 的 chat panel 完全不能用。

Vibe coding 的核心是「用自然語言告訴 AI 你要什麼 → review AI 的成果 → approve」，這個流程完全可以在手機上做好，前提是介面要為手機重新設計。Vibe Remote 就是這個重新設計的介面。
