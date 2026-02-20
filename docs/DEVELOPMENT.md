# Development Guide — Vibe Remote

## 前置需求

```
Node.js 20+ (LTS, 推薦 22)
npm 10+
Git 2.30+
Tailscale (installed and logged in)
Claude 認證（擇一）:
  - CLAUDE_CODE_OAUTH_TOKEN (透過 `claude setup-token` 取得)
  - ANTHROPIC_API_KEY (從 console.anthropic.com 取得)
```

Optional:
```
Docker + Docker Compose  — 容器化部署
GitHub CLI (gh)          — PR 相關操作
```

## 初始設定

```bash
# Clone
git clone https://github.com/YOUR_USERNAME/vibe-remote.git
cd vibe-remote

# 環境變數
cp .env.example .env
# 編輯 .env，填入認證資訊（CLAUDE_CODE_OAUTH_TOKEN 或 ANTHROPIC_API_KEY）和 JWT_SECRET

# 安裝依賴
cd server && npm install && cd ..
cd client && npm install && cd ..

# 啟動開發模式
npm run dev
# → Server: http://localhost:3000
# → Client (Vite): http://localhost:5173 (proxy API/WS to :3000)
```

## 專案結構

```
vibe-remote/
├── CLAUDE.md                      # Claude Code 開發指引
├── README.md                      # GitHub 首頁
├── package.json                   # Root monorepo scripts (concurrently)
├── docker-compose.yml             # Docker Compose（server:8080 + client:8081）
├── .env.example                   # 環境變數範本
│
├── docs/                          # 設計文件
│   ├── ARCHITECTURE.md
│   ├── API_SPEC.md
│   ├── DATABASE.md
│   ├── UI_UX.md
│   ├── AI_ENGINE.md
│   ├── SECURITY.md
│   ├── DEVELOPMENT.md             # ← 你在這裡
│   └── ROADMAP.md
│
├── server/                        # Backend (Node.js + Express + TypeScript)
│   ├── src/
│   │   ├── index.ts               # Entry: Express + WS server
│   │   ├── config.ts              # 環境變數管理（zod validated）
│   │   ├── auth/                  # JWT + QR pairing
│   │   │   ├── index.ts
│   │   │   ├── jwt.ts             # JWT sign/verify
│   │   │   ├── jwt.test.ts
│   │   │   ├── middleware.ts      # Express auth middleware
│   │   │   └── pairing.ts        # QR code + pairing code
│   │   ├── ai/                    # Claude Agent SDK 整合
│   │   │   ├── index.ts
│   │   │   ├── claude-sdk.ts      # ClaudeSdkRunner（streaming + tool tracking）
│   │   │   ├── context-builder.ts # Project context 組裝
│   │   │   └── types.ts
│   │   ├── workspace/             # Git ops + file tree
│   │   │   ├── index.ts
│   │   │   ├── manager.ts         # Workspace CRUD + path mapping
│   │   │   ├── git-ops.ts         # simple-git wrapper
│   │   │   └── file-tree.ts       # 目錄結構產生器
│   │   ├── diff/                  # Diff 解析與管理
│   │   │   ├── index.ts
│   │   │   ├── manager.ts         # Diff CRUD
│   │   │   ├── parser.ts          # Unified diff parser
│   │   │   └── types.ts
│   │   ├── routes/                # Express route handlers
│   │   │   ├── index.ts           # Route aggregator
│   │   │   ├── auth.ts
│   │   │   ├── chat.ts
│   │   │   ├── diff.ts
│   │   │   ├── workspaces.ts      # CRUD + git operations
│   │   │   └── notifications.ts
│   │   ├── ws/                    # WebSocket event handlers
│   │   │   ├── index.ts
│   │   │   ├── chat-handler.ts    # Main handler（chat_send, retry, tool approval）
│   │   │   ├── rate-limit.ts      # Per-device rate limiting
│   │   │   ├── rate-limit.test.ts
│   │   │   ├── tool-approval.ts   # Tool approval workflow
│   │   │   └── tool-approval.test.ts
│   │   ├── notifications/         # Push notifications
│   │   │   ├── index.ts
│   │   │   └── push.ts            # web-push wrapper
│   │   ├── db/                    # SQLite 資料庫
│   │   │   ├── index.ts           # DB init + helpers + migrations
│   │   │   └── schema.ts          # CREATE TABLE statements
│   │   ├── utils/
│   │   │   └── truncate.ts        # 訊息/檔案截斷工具
│   │   ├── tasks/                 # Phase 2（目前空目錄）
│   │   ├── terminal/              # Phase 2（目前空目錄）
│   │   └── test/
│   │       └── setup.ts           # Vitest setup
│   ├── Dockerfile                 # Node 22-slim + better-sqlite3 build deps
│   ├── package.json
│   └── tsconfig.json
│
├── client/                        # Frontend (React PWA)
│   ├── src/
│   │   ├── App.tsx                # Route definitions
│   │   ├── main.tsx               # Entry point
│   │   ├── pages/
│   │   │   ├── ChatPage.tsx
│   │   │   ├── DiffPage.tsx
│   │   │   ├── TasksPage.tsx
│   │   │   ├── ReposPage.tsx
│   │   │   └── SettingsPage.tsx
│   │   ├── components/
│   │   │   ├── AppLayout.tsx      # Layout wrapper（WorkspaceTabs + BottomNav）
│   │   │   ├── BottomNav.tsx      # 5-tab 底部導覽
│   │   │   ├── BottomSheet.tsx    # 滑出式面板
│   │   │   ├── ConversationSelector.tsx  # 對話選擇器
│   │   │   ├── Toast.tsx          # Toast 通知
│   │   │   ├── WorkspaceTabs.tsx  # Workspace 切換 tabs
│   │   │   ├── chat/              # Chat UI 元件
│   │   │   │   ├── MessageList.tsx
│   │   │   │   ├── MessageBubble.tsx
│   │   │   │   ├── ChatInput.tsx
│   │   │   │   ├── TokenUsageCard.tsx
│   │   │   │   ├── ToolApprovalCard.tsx
│   │   │   │   └── index.ts
│   │   │   ├── diff/              # Diff review 元件
│   │   │   │   ├── DiffViewer.tsx
│   │   │   │   ├── FileList.tsx
│   │   │   │   ├── ReviewActions.tsx
│   │   │   │   └── index.ts
│   │   │   └── actions/           # Quick Actions 元件
│   │   │       ├── QuickActions.tsx
│   │   │       ├── GitStatusCard.tsx
│   │   │       ├── ActionButton.tsx
│   │   │       └── index.ts
│   │   ├── stores/                # zustand stores
│   │   │   ├── auth.ts            # JWT + device 狀態
│   │   │   ├── chat.ts            # Per-workspace 對話（workspaceChats map）
│   │   │   ├── workspace.ts       # Workspace 列表 + Git state
│   │   │   ├── diff.ts            # Diff review 狀態
│   │   │   └── toast.ts           # Toast 通知佇列
│   │   ├── services/
│   │   │   ├── api.ts             # REST client（fetch wrapper）
│   │   │   ├── websocket.ts       # WebSocket auto-reconnect client
│   │   │   ├── push.ts            # Push notification subscription
│   │   │   └── speech.ts          # Web Speech API wrapper
│   │   ├── hooks/
│   │   │   ├── usePushNotifications.ts
│   │   │   └── useSpeech.ts
│   │   └── styles/
│   │       └── globals.css        # Tailwind directives + CSS variables
│   ├── public/
│   │   └── icons/                 # PWA SVG icons
│   ├── Dockerfile                 # Node 22-slim（dev server）
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── tsconfig.json
│
└── shared/                        # Server + Client 共用
    └── types.ts                   # API request/response types
```

## npm Scripts

### Root package.json

```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:client\"",
    "dev:server": "npm --prefix server run dev",
    "dev:client": "npm --prefix client run dev",
    "build": "npm run build:server && npm run build:client",
    "build:server": "npm --prefix server run build",
    "build:client": "npm --prefix client run build",
    "lint": "npm --prefix server run lint && npm --prefix client run lint",
    "typecheck": "npm --prefix server run typecheck && npm --prefix client run typecheck"
  },
  "devDependencies": {
    "concurrently": "^8.2.2"
  }
}
```

### Server package.json

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "lint": "eslint src --ext .ts",
    "typecheck": "tsc --noEmit",
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage"
  }
}
```

### Client package.json

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint src --ext .ts,.tsx",
    "typecheck": "tsc --noEmit"
  }
}
```

## TypeScript 設定

### Server tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "..",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "paths": {
      "@shared/*": ["../shared/*"]
    },
    "baseUrl": "."
  },
  "include": ["src/**/*", "../shared/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Client tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitReturns": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "paths": {
      "@/*": ["./src/*"],
      "@shared/*": ["../shared/*"]
    },
    "baseUrl": "."
  },
  "include": ["src", "../shared"]
}
```

## Coding Standards

### 命名

```
Files:         kebab-case         context-builder.ts
Components:    PascalCase         ChatInput.tsx
Functions:     camelCase          getProjectContext()
Variables:     camelCase          currentWorkspace
Constants:     UPPER_SNAKE_CASE   MAX_FILE_SIZE
DB columns:    snake_case         workspace_id
API routes:    kebab-case         /api/chat/upload-image
Types/IFs:     PascalCase         interface WorkspaceStatus
```

### Import 順序

```typescript
// 1. Node.js builtins
import path from 'path';
import { readFileSync, existsSync } from 'fs';

// 2. External packages
import express from 'express';
import { z } from 'zod';

// 3. Shared (monorepo)
import type { Workspace } from '@shared/types';

// 4. Internal (relative)
import { getDb } from '../db/index.js';
import { config } from '../config.js';
```

> **Note**: Server imports 使用 `.js` extension（ESM module resolution 要求）。

### Error Handling

```typescript
// Server: 統一 error 格式
// 目前使用簡單的 throw + Express error handler
// API routes 回傳格式:
res.status(404).json({
  error: 'Workspace not found',
  code: 'NOT_FOUND',
});

res.status(400).json({
  error: 'Validation failed',
  code: 'VALIDATION_ERROR',
  details: zodError.format(),
});
```

### Logging

```typescript
// 目前使用 console.log / console.error / console.warn
// 帶 emoji prefix 區分類型:
console.log('✅ Server started', { port, host });
console.error('❌ Database error', error.message);
console.warn('⚠️ No Claude authentication configured');
```

## Vite Proxy 設定

開發時 client (5173) 代理到 server (3000)：

```typescript
// client/vite.config.ts
export default defineConfig({
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:3000',
        changeOrigin: true,
      },
      '/ws': {
        target: (process.env.VITE_API_URL || 'http://localhost:3000').replace('http', 'ws'),
        ws: true,
      },
    },
  },
});
```

Docker 內 client 透過 `VITE_API_URL=http://server:8080` 指向同網路內的 server container。

## Docker

### 架構

Docker Compose 使用雙容器架構（而非單一容器）：

```
┌─────────────────────────────────────────────┐
│ Docker Compose (vibe-network bridge)        │
│                                             │
│  ┌─────────────┐     ┌──────────────┐       │
│  │   server     │     │    client    │       │
│  │ Node 22-slim │     │ Node 22-slim │       │
│  │ Port: 8080   │◄────│ VITE proxy   │       │
│  │ SQLite + SDK │     │ Port: 5173   │       │
│  └──────┬───────┘     └──────┬───────┘       │
│         │                    │               │
└─────────┼────────────────────┼───────────────┘
          │                    │
     host:8080            host:8081
```

### Server Dockerfile

```dockerfile
FROM node:22-slim

WORKDIR /app

# better-sqlite3 需要 build tools
RUN apt-get update && apt-get install -y \
    python3 make g++ git \
    && rm -rf /var/lib/apt/lists/*

# Claude Code CLI（Agent SDK 依賴）
RUN npm install -g @anthropic-ai/claude-code

COPY package*.json ./
RUN npm ci

COPY . .

# 建立資料目錄和 workspace mount point
# node user (uid 1000) 對應 host ubuntu user (uid 1000)
RUN mkdir -p data /workspace && \
    chown -R node:node /app /workspace

EXPOSE 8080

# Claude CLI 拒絕以 root 執行 --dangerously-skip-permissions
USER node

CMD ["npx", "tsx", "src/index.ts"]
```

### Client Dockerfile

```dockerfile
FROM node:22-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci
COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
```

### docker-compose.yml

```yaml
services:
  server:
    build: { context: ./server, dockerfile: Dockerfile }
    ports: ["8080:8080"]
    volumes:
      - /home/ubuntu:/workspace:rw        # Workspace 掛載
      - ./server/data:/app/data            # DB 持久化
      - ~/.claude:/home/node/.claude:rw    # Claude SDK credentials
    environment:
      - PORT=8080
      - JWT_SECRET=dev-secret-key-...
      - CLAUDE_PERMISSION_MODE=bypassPermissions
      - CLAUDE_CODE_OAUTH_TOKEN=${CLAUDE_CODE_OAUTH_TOKEN}
      - WORKSPACE_HOST_PATH=/home/ubuntu
      - WORKSPACE_CONTAINER_PATH=/workspace
    networks: [vibe-network]

  client:
    build: { context: ./client, dockerfile: Dockerfile }
    ports: ["8081:5173"]
    environment:
      - VITE_API_URL=http://server:8080
    depends_on: [server]
    networks: [vibe-network]

networks:
  vibe-network:
    driver: bridge
```

### Docker 啟動

```bash
# 建置並啟動
docker compose up -d --build

# 查看 logs
docker compose logs -f

# 停止
docker compose down

# 存取
# Server API: http://localhost:8080/api
# Client UI:  http://localhost:8081
```

### Workspace Path Mapping

Docker 中 user 輸入的是 host path（如 `/home/ubuntu/myproject`），但 container 內掛載在 `/workspace/myproject`。`manager.ts` 中的 `mapHostPathToContainer()` 自動做轉換：

```
WORKSPACE_HOST_PATH=/home/ubuntu
WORKSPACE_CONTAINER_PATH=/workspace

使用者輸入: /home/ubuntu/myproject
Container 看到: /workspace/myproject
```

## 環境變數

```bash
# .env.example
NODE_ENV=development
PORT=3000
HOST=0.0.0.0

# JWT
JWT_SECRET=your-super-secret-jwt-key-at-least-32-chars
JWT_EXPIRES_IN=7d

# Claude Agent SDK（擇一）
# CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat01-...  # OAuth token (Max subscription)
# ANTHROPIC_API_KEY=sk-ant-api-...          # API key (pay-per-use)
CLAUDE_MODEL=claude-sonnet-4-20250514
CLAUDE_PERMISSION_MODE=bypassPermissions    # default | acceptEdits | bypassPermissions

# Database
DATABASE_PATH=./data/vibe-remote.db

# Workspace Path Mapping (Docker only)
# WORKSPACE_HOST_PATH=/home/ubuntu
# WORKSPACE_CONTAINER_PATH=/workspace

# Push Notifications (optional)
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:your-email@example.com
```

## 測試

```bash
# Server tests (vitest)
npm --prefix server run test        # Watch mode
npm --prefix server run test:run    # Single run
npm --prefix server run test:coverage

# 現有測試:
# - server/src/auth/jwt.test.ts
# - server/src/ws/rate-limit.test.ts
# - server/src/ws/tool-approval.test.ts
```

### 測試策略

```
Server:
  - Unit tests: vitest
  - 測試重點: JWT, rate limiting, tool approval, path validation

Client:
  - 尚未設定測試框架
  - 建議: vitest + React Testing Library

E2E:
  - 尚未設定
  - 建議: Playwright (Phase 2+)
```

## 主要依賴

### Server

| Package | 版本 | 用途 |
|---------|------|------|
| `@anthropic-ai/claude-agent-sdk` | ^0.2.45 | Claude Agent SDK |
| `better-sqlite3` | ^11.7.0 | SQLite（同步 API） |
| `express` | ^4.21.2 | HTTP server |
| `express-ws` | ^5.0.2 | WebSocket support |
| `simple-git` | ^3.27.0 | Git 操作 |
| `jsonwebtoken` | ^9.0.2 | JWT 認證 |
| `qrcode` | ^1.5.4 | QR code 產生 |
| `web-push` | ^3.6.7 | Push notifications |
| `zod` | ^4.3.6 | Schema validation |
| `chokidar` | ^4.0.3 | File watch |
| `node-pty` | ^1.0.0 | Terminal（Phase 2） |
| `tsx` | ^4.19.2 | TypeScript execution（dev） |
| `vitest` | ^4.0.18 | Test framework |

### Client

| Package | 版本 | 用途 |
|---------|------|------|
| `react` | ^18.3.1 | UI framework |
| `react-dom` | ^18.3.1 | React DOM renderer |
| `react-router-dom` | ^7.1.1 | Client routing |
| `zustand` | ^5.0.11 | State management |
| `clsx` | ^2.1.1 | Conditional class names |
| `tailwindcss` | ^3.4.17 | CSS framework |
| `vite` | ^6.0.7 | Build tool |
| `vite-plugin-pwa` | ^0.21.1 | PWA support |
