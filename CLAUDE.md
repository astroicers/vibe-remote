# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

Vibe Remote is a mobile-first PWA that lets engineers drive AI coding tasks from a phone via natural language. The core workflow is: **Chat → AI executes in background → Review diff → Approve → Commit**. It is not a mobile IDE.

## Commands

```bash
# Development (runs server on :3000 + client on :5173 concurrently)
npm run dev

# Run server or client independently
npm --prefix server run dev
npm --prefix client run dev

# Type check
npm --prefix server run typecheck
npm --prefix client run typecheck

# Lint
npm --prefix server run lint
npm --prefix client run lint

# Tests (watch mode)
npm --prefix server test
npm --prefix client test

# Tests (single run)
npm --prefix server run test:run
npm --prefix client run test:run

# Tests with coverage
npm --prefix server run test:coverage
npm --prefix client run test:coverage

# Build
npm run build

# Docker (production: API + SPA served from :8080, HTTPS via Caddy at :8443)
docker compose up -d
docker compose logs -f vibe-remote
docker compose up -d --build
```

## Architecture

### Monorepo Layout

- **`server/`** — Node.js 22 + Express + TypeScript, runs on port 3000 (dev) / 8080 (Docker)
- **`client/`** — React 19 + Vite 6 + Tailwind CSS 4 PWA, runs on port 5173 (dev), proxies `/api` and `/ws` to server
- **`shared/types.ts`** — Single source of truth for all TypeScript interfaces shared between server and client
- **`docs/`** — Architecture, API spec, DB schema, and 20 ADRs documenting every key decision

The monorepo does **not** use npm workspaces; use `npm --prefix server` / `npm --prefix client` for subpackage commands.

In Docker production, a single container serves both the API and the compiled SPA static files. A Caddy sidecar handles HTTPS with a self-signed internal CA.

### Server Module Map (`server/src/`)

| Module | Responsibility |
|--------|---------------|
| `index.ts` | Express + express-ws app entry; clears `CLAUDECODE` env so nested Claude SDK sessions work |
| `config.ts` | Zod-validated env config; exits on invalid env |
| `db/` | better-sqlite3 init with WAL mode + foreign keys; schema + seed in `schema.ts`; all IDs use `generateId(prefix)` → `prefix_<base36timestamp><random>` |
| `auth/` | JWT device pairing, QR code flow, auth middleware |
| `ai/claude-sdk.ts` | `ClaudeSdkRunner` — wraps `@anthropic-ai/claude-agent-sdk` query(), streams events (text, tool_use, tool_result, token_usage, error, done), supports abort() |
| `ai/context-builder.ts` | Builds system prompt from workspace file tree (depth 2) + git status + recent 3 commits + key config files |
| `workspace/` | `manager.ts` for workspace CRUD with Docker path mapping; `git-ops.ts` for simple-git wrapper; `file-tree.ts` respects .gitignore |
| `tasks/` | Async task queue: `manager.ts` (CRUD), `queue.ts` (in-memory TaskQueue), `runner.ts` (AI execution via ClaudeSdkRunner) |
| `diff/` | Parses git diff into structured `FileDiff[]`; manages review CRUD and per-file approve/reject |
| `ws/chat-handler.ts` | Core WebSocket handler; maintains `Map<workspaceId:conversationId, RunnerState>` for up to `MAX_CONCURRENT_RUNNERS` (default 3) parallel AI runners |
| `ws/tool-approval.ts` | In-memory store for pending tool approvals when `TOOL_APPROVAL_ENABLED=true` |
| `routes/` | REST handlers: auth, workspaces, chat, diff, tasks, templates, notifications |
| `notifications/` | Web push via VAPID |
| `utils/truncate.ts` | Token optimization: truncates history to 5 messages × 2000 chars; skips context files >1MB |

### Client Module Map (`client/src/`)

| Module | Responsibility |
|--------|---------------|
| `services/api.ts` | Fetch wrapper for all REST calls |
| `services/websocket.ts` | Native WebSocket + auto-reconnect (exponential backoff: 1→2→4→8→16s, max 5 retries) |
| `stores/` | Zustand stores, all keyed by `workspaceId`; never use implicit global state |
| `pages/` | ChatPage, DiffPage, TasksPage, ReposPage, SettingsPage |
| `components/AppLayout.tsx` | App shell with WorkspaceTabs + BottomNav |

### Multi-Workspace State Partitioning

All state is partitioned by `workspaceId`. On the server, runners are tracked in `Map<"wsId:convId", RunnerState>`. On the client, every store uses `Record<workspaceId, State>`. WebSocket events always carry `workspaceId` for routing. This is the core architectural pattern — never introduce global singleton state.

### AI Execution Flow

1. Client sends `chat_send` event via WebSocket with `workspaceId` + `conversationId`
2. `chat-handler` checks runner map (rejects if same conversation already running)
3. Context builder assembles: user message + file tree + git status + truncated history
4. `ClaudeSdkRunner` sets `cwd = workspace.path` and calls Agent SDK `query()`
5. SDK handles tool_use loop internally (Read, Write, Edit, Bash, Grep, Glob)
6. All streaming events are forwarded to client with `workspaceId`
7. On completion: message + token usage saved to SQLite; if files were modified → `diff:ready` event fired

### SQLite Schema Notes

- Tables: `devices`, `workspaces`, `conversations`, `messages`, `tasks`, `diff_reviews`, `diff_comments`, `push_subscriptions`, `prompt_templates`, `device_settings`
- `conversations.sdk_session_id` — Claude Agent SDK session ID, persisted for session resume to reduce token cost
- `conversations.token_usage` — JSON with `{ input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, cost_usd }`
- JSON columns (tool_calls, keys, files_json, etc.) are stored as TEXT; parse/serialize at the application layer
- WAL mode + `busy_timeout 5000ms` allow concurrent reads during AI writes

## Environment Variables

Key variables (see `.env.example` for full list):

| Variable | Default | Notes |
|----------|---------|-------|
| `CLAUDE_CODE_OAUTH_TOKEN` | — | Preferred auth; generate with `claude setup-token` |
| `ANTHROPIC_API_KEY` | — | Alternative to OAuth token |
| `CLAUDE_PERMISSION_MODE` | `bypassPermissions` | `default` \| `acceptEdits` \| `bypassPermissions` |
| `CLAUDE_MODEL` | `claude-sonnet-4-20250514` | Overridable per-device via settings API |
| `JWT_SECRET` | auto-generated | Set explicitly in production or tokens won't survive restart |
| `WORKSPACE_HOST_PATH` | `/home/ubuntu` | Host path mounted into Docker as `/workspace` |
| `MAX_CONCURRENT_RUNNERS` | `3` | Each runner spawns a subprocess; memory-sensitive |
| `RUNNER_TIMEOUT_MS` | `600000` | 10 minutes per AI task |
| `TOOL_APPROVAL_ENABLED` | `false` | When true, tool calls block for WebSocket user approval |

## Coding Standards

- TypeScript `strict: true` everywhere; no `any` — use `unknown` + type guards
- Use `interface` for object shapes; `type` only for unions/aliases
- All API request/response bodies validated with zod schemas
- Server error responses always: `{ error: string, code: string, details?: unknown }`
- Database columns: `snake_case`; files: `kebab-case`; components: `PascalCase`; functions/vars: `camelCase`
- Commit messages: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`)
- `better-sqlite3` is synchronous — never wrap it in async/await or promises
- `process.env.CLAUDECODE` is deleted at startup so the server can spawn nested Claude SDK sessions

## Known Gotchas

- **Docker build**: `better-sqlite3` is a native module requiring `python3 + make + g++` in the build image
- **Claude CLI in Docker**: runs as `node` user, not `root` — Claude CLI refuses `--dangerously-skip-permissions` as root
- **iOS PWA push notifications**: requires iOS 16.4+ and user must manually "Add to Home Screen"
- **Docker path mapping**: host paths (e.g. `/home/ubuntu/myproject`) are remapped to container paths (`/workspace/myproject`) via `mapHostPathToContainer()` — always register workspaces using host paths
- **Runner race condition**: same `workspaceId:conversationId` key prevents two runners from starting on the same conversation
- **HTTPS on Android**: Caddy uses `tls internal` (self-signed CA); run `./scripts/export-ca.sh` and install `ca.crt` on Android via Settings → Security → Install certificate → CA certificate
