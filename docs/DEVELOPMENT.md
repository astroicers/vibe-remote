# Development Guide — Vibe Remote

## 前置需求

```
Node.js 20+ (LTS)
npm 10+
Git 2.30+
Tailscale (installed and logged in)
Anthropic API key (claude.ai → API keys)
```

Optional:
```
ripgrep (rg) — for codebase search (fallback: grep)
GitHub CLI (gh) — for PR creation
```

## 初始設定

```bash
# Clone
git clone https://github.com/YOUR_USERNAME/vibe-remote.git
cd vibe-remote

# 環境變數
cp .env.example .env
# 編輯 .env，填入 ANTHROPIC_API_KEY 和 JWT_SECRET

# 安裝依賴
cd server && npm install && cd ..
cd client && npm install && cd ..

# 啟動開發模式
npm run dev
# → Server: http://localhost:3000
# → Client (Vite): http://localhost:5173 (proxy to 3000)
```

## 專案結構

```
vibe-remote/
├── CLAUDE.md                      # Claude Code 開發指引
├── README.md                      # GitHub 首頁
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
├── server/                        # Backend
│   ├── src/
│   │   ├── index.ts               # Entry: Express + WS server
│   │   ├── config.ts              # 環境變數 + 設定管理
│   │   ├── routes/                # Express route handlers
│   │   │   ├── auth.ts
│   │   │   ├── workspaces.ts
│   │   │   ├── chat.ts
│   │   │   ├── diff.ts
│   │   │   ├── git.ts
│   │   │   ├── tasks.ts
│   │   │   ├── terminal.ts
│   │   │   └── templates.ts
│   │   ├── ws/                    # WebSocket event handlers
│   │   │   ├── index.ts           # WS server setup + connection handler
│   │   │   └── handlers.ts        # Event routing
│   │   ├── auth/
│   │   │   ├── jwt.ts             # JWT sign/verify/refresh
│   │   │   ├── middleware.ts      # Express auth middleware
│   │   │   └── pairing.ts        # QR code + pairing code
│   │   ├── ai/
│   │   │   ├── claude-client.ts   # Anthropic SDK wrapper + streaming
│   │   │   ├── context-builder.ts # Project context 組裝
│   │   │   ├── tool-executor.ts   # Tool use 執行 + 安全驗證
│   │   │   ├── tools.ts           # Tool definitions (JSON schema)
│   │   │   └── prompts.ts         # System prompts
│   │   ├── workspace/
│   │   │   ├── manager.ts         # Workspace CRUD
│   │   │   ├── git-ops.ts         # simple-git wrapper
│   │   │   ├── file-tree.ts       # 目錄結構產生器
│   │   │   ├── file-watcher.ts    # chokidar 監聽
│   │   │   └── search.ts          # ripgrep/grep wrapper
│   │   ├── tasks/                 # Phase 2
│   │   │   ├── queue.ts
│   │   │   ├── runner.ts
│   │   │   ├── branch-manager.ts
│   │   │   └── dependency.ts
│   │   ├── terminal/
│   │   │   ├── runner.ts          # Command execution
│   │   │   └── validator.ts       # Command whitelist/blacklist
│   │   ├── notifications/
│   │   │   └── web-push.ts        # VAPID + push
│   │   ├── db/
│   │   │   ├── sqlite.ts          # DB connection + init
│   │   │   ├── migrate.ts         # Migration runner
│   │   │   └── migrations/
│   │   │       ├── 001_initial.sql
│   │   │       └── ...
│   │   ├── middleware/
│   │   │   ├── error-handler.ts   # Global error handler
│   │   │   ├── rate-limiter.ts    # Rate limiting setup
│   │   │   └── validate.ts        # Zod validation middleware
│   │   └── utils/
│   │       ├── id.ts              # nanoid helpers (ws_xxx, conv_xxx)
│   │       └── logger.ts          # Structured logging
│   ├── package.json
│   └── tsconfig.json
│
├── client/                        # Frontend (React PWA)
│   ├── src/
│   │   ├── App.tsx                # Root component + router
│   │   ├── main.tsx               # Entry point
│   │   ├── pages/
│   │   │   ├── ChatPage.tsx
│   │   │   ├── DiffPage.tsx
│   │   │   ├── TasksPage.tsx
│   │   │   ├── ReposPage.tsx
│   │   │   └── SettingsPage.tsx
│   │   ├── components/
│   │   │   ├── chat/
│   │   │   ├── diff/
│   │   │   ├── tasks/
│   │   │   ├── workspace/
│   │   │   ├── actions/
│   │   │   └── common/
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts
│   │   │   ├── useSpeechRecognition.ts
│   │   │   ├── useNotifications.ts
│   │   │   └── useApi.ts
│   │   ├── stores/                # zustand stores
│   │   │   ├── authStore.ts
│   │   │   ├── chatStore.ts
│   │   │   ├── diffStore.ts
│   │   │   ├── workspaceStore.ts
│   │   │   └── taskStore.ts
│   │   ├── services/
│   │   │   ├── api.ts             # REST client (fetch wrapper)
│   │   │   └── ws.ts              # WebSocket client + auto-reconnect
│   │   ├── types/
│   │   │   └── index.ts           # Client-side types
│   │   ├── styles/
│   │   │   └── globals.css        # Tailwind directives + custom CSS vars
│   │   ├── manifest.json          # PWA manifest
│   │   └── service-worker.ts
│   ├── public/
│   │   └── icons/                 # PWA icons (192, 512)
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── tsconfig.json
│
├── shared/                        # Server + Client 共用
│   ├── types.ts                   # API request/response types
│   └── constants.ts               # Shared constants
│
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── .gitignore
├── .eslintrc.cjs
├── .prettierrc
└── package.json                   # Root scripts (dev, build, lint)
```

## npm Scripts

### Root package.json

```json
{
  "scripts": {
    "dev": "concurrently \"npm --prefix server run dev\" \"npm --prefix client run dev\"",
    "build": "npm --prefix server run build && npm --prefix client run build",
    "start": "npm --prefix server run start",
    "lint": "npm --prefix server run lint && npm --prefix client run lint",
    "typecheck": "npm --prefix server run typecheck && npm --prefix client run typecheck"
  },
  "devDependencies": {
    "concurrently": "^8.0.0"
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
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit"
  }
}
```

### Client package.json

```json
{
  "scripts": {
    "dev": "vite --port 5173",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint src/",
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
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "paths": {
      "@shared/*": ["../shared/*"]
    }
  },
  "include": ["src/**/*", "../shared/**/*"]
}
```

### Client tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "paths": {
      "@/*": ["./src/*"],
      "@shared/*": ["../shared/*"]
    }
  },
  "include": ["src/**/*", "../shared/**/*"]
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
import { readFile } from 'fs/promises';

// 2. External packages
import express from 'express';
import { z } from 'zod';

// 3. Shared (monorepo)
import type { Workspace } from '@shared/types';

// 4. Internal (relative)
import { db } from '../db/sqlite';
import { validatePath } from './validator';
```

### Error Handling

```typescript
// Server: 統一 error 格式
class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
  }
}

// 使用
throw new AppError(404, 'NOT_FOUND', 'Workspace not found');
throw new AppError(422, 'VALIDATION_ERROR', 'Invalid path', errors);

// Global error handler 自動格式化
app.use((err, req, res, next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      details: err.details,
    });
  } else {
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
});
```

### Logging

```typescript
// 使用 structured logging
// 可以用簡單的 console 或 pino
import { logger } from './utils/logger';

logger.info('Server started', { port: 3000, host: '0.0.0.0' });
logger.error('AI request failed', { error: err.message, conversationId });
logger.warn('Rate limit hit', { deviceId, endpoint: '/api/chat/send' });
```

## Vite Proxy 設定

開發時 client (5173) 代理到 server (3000)：

```typescript
// client/vite.config.ts
export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
      },
    },
  },
});
```

## Docker

```dockerfile
# Dockerfile
FROM node:20-alpine

# better-sqlite3 需要 build tools
RUN apk add --no-cache python3 make g++ git

WORKDIR /app

# Server dependencies
COPY server/package*.json server/
RUN cd server && npm ci --production

# Client build
COPY client/package*.json client/
RUN cd client && npm ci
COPY client/ client/
COPY shared/ shared/
RUN cd client && npm run build

# Server build
COPY server/ server/
RUN cd server && npm run build

# 把 client build 放到 server 可以 serve 的位置
RUN cp -r client/dist server/public

EXPOSE 3000
CMD ["node", "server/dist/index.js"]
```

## 測試策略（建議但 MVP 可跳過）

```
Server:
  - Unit tests: vitest (or jest)
  - 測試重點: tool validation, path sanitization, git ops mock

Client:
  - Component tests: vitest + React Testing Library
  - 測試重點: chat input, diff viewer, approve/reject flow

E2E:
  - Playwright (Phase 2+)
  - 測試重點: 完整 flow — chat → diff → approve → commit
```
