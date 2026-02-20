# Security Design — Vibe Remote

## 威脅模型

Vibe Remote 是一個個人/小團隊工具，部署在 Tailscale 網路內。主要威脅：

| 威脅 | 嚴重度 | 緩解措施 |
|------|--------|---------|
| 未授權存取 server | 高 | Tailscale + JWT + device binding |
| AI 執行惡意指令 | 高 | Claude Agent SDK 權限模式 + workspace cwd 限制 |
| API key 外洩 | 高 | .env 不入 git + 環境變數注入 |
| Session 劫持 | 中 | JWT 短效期 + refresh token rotation |
| Workspace 路徑穿越 | 高 | SDK 限制 file ops 在 cwd 內 + Docker volume mount 限制 |
| Git force push 資料遺失 | 中 | Force push 需二次確認 + 禁用白名單 |

## 網路層：Tailscale

```
開發環境:
Internet ──X──→ Server (localhost:3000) + Client (localhost:5173 via Vite)

Docker 環境:
Internet ──X──→ Server (port 8080) + Client (port 8081)
                    │
Tailscale Network ──→ Server (100.x.y.z:8080 [allowed])
                    │
                    ├── 手機 (Tailscale app)
                    └── 電腦 (Tailscale daemon)
```

- Vibe Remote Server 只監聽 Tailscale interface 或 localhost
- **不需要** 設定防火牆開放 port
- WireGuard 加密所有流量
- Tailscale ACL 可進一步限制哪些裝置能連

### Port 配置

| 環境 | Server | Client | 說明 |
|------|--------|--------|------|
| 開發 (dev) | localhost:3000 | localhost:5173 | Vite dev server 代理 API |
| Docker | 8080 (host) → 8080 (container) | 8081 (host) → 5173 (container) | docker-compose 設定 |

### Server 綁定設定

```typescript
// server/src/config.ts — 實際實作
const HOST = process.env.HOST || '0.0.0.0';
const PORT = parseInt(process.env.PORT || '3000'); // Docker 環境設為 8080
```

### CORS 設定

目前 CORS 為開放模式（`cors()` 無參數），因為在 Tailscale 網路內：

```typescript
// server/src/index.ts — 實際實作
app.use(cors());
```

> **注意**: 未來可考慮限制 CORS origin 到 Tailscale IP 範圍。目前安全性由 Tailscale 網路層保障。

## 認證層：JWT + QR Code Pairing

### 首次配對流程

```
電腦 (已登入 Tailscale):

1. 打開 https://100.x.y.z:3000/setup
2. Server 產生:
   - pairingCode: random 8 chars (有效 5 分鐘)
   - QR code 內容: vibe-remote://pair?code=a1b2c3d4&server=100.x.y.z:3000
3. 畫面顯示 QR code

手機:

4. 打開 https://100.x.y.z:3000 (首次)
5. 畫面要求掃描 QR code (或手動輸入 pairing code)
6. POST /api/auth/pair 帶上:
   - pairingCode
   - deviceName (自動偵測 "iPhone 15 Pro")
   - deviceId (瀏覽器 fingerprint 或 random UUID stored in localStorage)
7. Server 驗證 pairing code
8. Server 回傳:
   - JWT token (有效期 7 天)
   - Refresh token (有效期 30 天)
9. 手機儲存 tokens 到 localStorage
10. 之後每次連線帶 JWT header
```

### JWT 設計

```
JWT Payload:
{
  "sub": "dev_abc123",           // device ID
  "deviceName": "iPhone 15 Pro",
  "iat": 1709280000,
  "exp": 1709884800              // 7 days
}

Signing: HS256 with JWT_SECRET (from .env)
```

### Token Refresh 流程

```
1. Client 偵測 JWT 即將過期 (剩餘 < 1 小時)
2. POST /api/auth/refresh with refresh token
3. Server 驗證 refresh token
4. Server 簽發新 JWT + 新 refresh token
5. 舊 refresh token 立即失效 (rotation)
```

### Session 管理

- 同一裝置同時只能有一個 active session
- Server 維護 devices 表追蹤已配對裝置
- 可在 Settings 頁面撤銷裝置存取

## 授權層

### 操作權限分級

```
Level 1 - Read Only:
  - 瀏覽 workspace / file tree
  - 查看 git status / log
  - 查看 diff
  - 查看 task 狀態
  - 查看對話歷史

Level 2 - AI Interaction (預設):
  - Level 1 全部 +
  - 與 AI 對話
  - AI 可讀寫 workspace 內的檔案
  - Approve / Reject diff
  - 執行預定義指令 (test, lint)

Level 3 - Git Operations (預設):
  - Level 2 全部 +
  - Git commit / push / pull
  - Create branch
  - Create PR

Level 4 - Dangerous (需二次確認):
  - Discard changes
  - Force push
  - Delete branch
  - 任何 git 操作涉及非 workspace 的 branch
```

MVP 預設所有已配對裝置都有 Level 3 權限。Level 4 操作每次都要求確認。

### 二次確認機制

```typescript
// 危險操作列表
const DANGEROUS_OPERATIONS = [
  'git_discard',
  'git_force_push',
  'git_delete_branch',
  'workspace_delete',
  'task_cancel_all',
];

// Client 端: 顯示確認對話框
// API 端: 要求 request body 包含 { confirm: true }
// 沒有 confirm: true → 400 CONFIRMATION_REQUIRED
```

## AI 安全

### Claude Agent SDK 整合

Vibe Remote 使用 `@anthropic-ai/claude-agent-sdk` 驅動 AI 操作，**不使用自定義 tool 定義**。SDK 提供內建工具：

| 內建工具 | 類型 | 說明 |
|----------|------|------|
| Read | 唯讀 | 讀取檔案內容 |
| Write | 寫入 | 建立或覆寫檔案 |
| Edit | 寫入 | 精確字串替換 |
| Bash | 執行 | 執行 shell 指令 |
| Grep | 唯讀 | 搜尋檔案內容 |
| Glob | 唯讀 | 依模式搜尋檔案名稱 |

### 權限模式

SDK 支援三種權限模式，透過 `CLAUDE_PERMISSION_MODE` 環境變數設定：

```
bypassPermissions (預設):
  - AI 可自由使用所有工具，無需人工確認
  - 適合個人開發環境 / Tailscale 保護下的使用場景
  - 需額外設定 allowDangerouslySkipPermissions: true

acceptEdits:
  - 讀取操作自動允許
  - 寫入操作需要使用者確認

default:
  - 所有工具使用都需要使用者確認
```

實際實作 (`server/src/ai/claude-sdk.ts`)：

```typescript
if (options.permissionMode === 'bypassPermissions') {
  sdkOptions.permissionMode = 'bypassPermissions';
  sdkOptions.allowDangerouslySkipPermissions = true;
} else if (options.permissionMode === 'acceptEdits') {
  sdkOptions.permissionMode = 'acceptEdits';
}
```

### Tool Approval System（非 bypass 模式）

當權限模式不是 `bypassPermissions` 時，`server/src/ws/tool-approval.ts` 提供 Promise-based 的審批機制：

```
流程:
1. SDK 要求執行某個工具
2. Server 透過 WebSocket 發送 tool_approval_request 到 Client
3. Client 顯示審批 UI（工具名稱、輸入參數、風險等級）
4. 使用者選擇 Approve / Reject
5. Client 發送 tool_approval_response 回 Server
6. Server resolve/reject Promise，SDK 繼續或中止

超時: 120 秒（超時自動 reject）
自動核准: 唯讀工具（Read, Glob, Grep）可設定自動核准
```

### Workspace 路徑限制

SDK 的 `cwd` 選項限制 AI 操作在 workspace 目錄內：

```typescript
const sdkOptions: Options = {
  cwd: options.workspacePath,  // AI 操作限制在此目錄
  // ...
};
```

> **注意**: 本專案**不實作**自定義的路徑驗證函式。路徑安全性完全由 Claude Agent SDK 內部管理，結合 Docker volume mount 的邊界限制。

### Terminal 指令安全

> **Note**: The `server/src/terminal/` directory is currently empty. There is no custom command whitelist or blacklist.
>
> All shell command execution goes through the Claude Agent SDK's built-in `Bash` tool, controlled by the permission mode settings above. In `bypassPermissions` mode, the AI can execute any shell command freely.

## API 安全

### Rate Limiting

Rate limiting 在 WebSocket 層實作，**不使用** `express-rate-limit` middleware。沒有 REST endpoint 專屬的 rate limit。

實作位於 `server/src/ws/rate-limit.ts` 和 `server/src/ws/chat-handler.ts`：

```typescript
// server/src/ws/chat-handler.ts — 實際實作
const RATE_LIMIT_WINDOW = 60000; // 1 分鐘
const RATE_LIMIT_MAX = 10;       // 每裝置 10 則訊息/分鐘

// 以 deviceId 為 key 的 in-memory Map<string, number[]>
const rateLimitMap = new Map<string, number[]>();

function checkRateLimit(deviceId: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(deviceId) || [];
  const recentTimestamps = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW);

  if (recentTimestamps.length >= RATE_LIMIT_MAX) {
    return false;
  }

  recentTimestamps.push(now);
  rateLimitMap.set(deviceId, recentTimestamps);
  return true;
}
```

此外，`server/src/ws/rate-limit.ts` 提供可重用的 `RateLimitStore` class，支援：
- `checkLimit(key)` — 檢查是否超限
- `getRemainingRequests(key)` — 剩餘配額
- `getTimeUntilReset(key)` — 等待重置時間
- 可動態調整 `windowMs` 和 `maxRequests`

另有並行限制（`chat-handler.ts`）：
- `MAX_CONCURRENT_RUNNERS = 3` — 全域最多 3 個同時執行的 Claude SDK 查詢
- 每個 conversation 同一時間只能有一個 runner

### Security Headers

> **尚未實作**: `helmet` middleware 目前未安裝也未使用。Server 只使用 `cors()` 和 `express.json()` middleware。
>
> 未來可考慮加入 helmet 設定 CSP、HSTS 等安全標頭。目前安全性主要依賴 Tailscale 網路層保護。

### Input Validation

所有 API input 用 zod 驗證：

```typescript
// 範例
const chatSendSchema = z.object({
  workspaceId: z.string().startsWith('ws_'),
  conversationId: z.string().startsWith('conv_').nullable(),
  message: z.string().min(1).max(10000),
  contextFiles: z.array(z.string()).max(10),
  templateId: z.string().startsWith('tpl_').nullable(),
  images: z.array(z.string()).max(3),  // base64
});
```

## HTTPS

### 開發環境
- HTTP OK（localhost / Tailscale 已加密）

### 生產環境
- 方案 A：Tailscale 自動 HTTPS (tailscale cert)
- 方案 B：Let's Encrypt + custom domain
- 方案 C：自簽憑證（手機需信任一次）

建議使用 Tailscale HTTPS（最簡單）：
```bash
tailscale cert your-machine.tail-xxxxx.ts.net
# 取得 .crt + .key 檔案
# Express 設定 HTTPS server
```

## 環境變數

```bash
# .env.example

# Claude Agent SDK authentication (primary method)
CLAUDE_CODE_OAUTH_TOKEN=...          # OAuth token from `claude setup-token`
CLAUDE_MODEL=claude-sonnet-4-20250514  # Model to use (default)
CLAUDE_PERMISSION_MODE=bypassPermissions  # default | acceptEdits | bypassPermissions

# JWT
JWT_SECRET=random-32-char-string     # JWT signing secret (min 32 chars)

# Push notifications (optional in dev)
VAPID_PUBLIC_KEY=...                 # PWA push notification
VAPID_PRIVATE_KEY=...                # PWA push notification
VAPID_SUBJECT=mailto:you@example.com # VAPID subject (email)

# Server
HOST=0.0.0.0
PORT=3000                            # Docker environment uses 8080
NODE_ENV=production

# Database
DATABASE_PATH=./data/vibe-remote.db  # SQLite DB location

# Workspace path mapping (Docker only)
WORKSPACE_HOST_PATH=/home/ubuntu     # Host path for workspace volumes
WORKSPACE_CONTAINER_PATH=/workspace  # Container mount point

# Optional
GITHUB_TOKEN=ghp_...                 # GitHub API for PR creation
```

**Note**: `CLAUDE_CODE_OAUTH_TOKEN` is the primary authentication method for the Claude Agent SDK. It is obtained via `claude setup-token` and replaces the older `ANTHROPIC_API_KEY` approach. The SDK uses this token for OAuth-based authentication.

WARNING: `.env` must be in `.gitignore` and must never be committed to git.
