# Security Design — Vibe Remote

## 威脅模型

Vibe Remote 是一個個人/小團隊工具，部署在 Tailscale 網路內。主要威脅：

| 威脅 | 嚴重度 | 緩解措施 |
|------|--------|---------|
| 未授權存取 server | 高 | Tailscale + JWT + device binding |
| AI 執行惡意指令 | 高 | Tool 白名單 + workspace sandbox |
| API key 外洩 | 高 | .env 不入 git + 環境變數注入 |
| Session 劫持 | 中 | JWT 短效期 + refresh token rotation |
| Workspace 路徑穿越 | 高 | 所有 file ops 驗證路徑在 workspace 內 |
| Git force push 資料遺失 | 中 | Force push 需二次確認 + 禁用白名單 |

## 網路層：Tailscale

```
Internet ──X──→ Server (port 3000 不對外開放)
                    │
Tailscale Network ──→ Server (100.x.y.z:3000 ✓)
                    │
                    ├── 手機 (Tailscale app)
                    └── 電腦 (Tailscale daemon)
```

- Vibe Remote Server 只監聽 Tailscale interface 或 localhost
- **不需要** 設定防火牆開放 port
- WireGuard 加密所有流量
- Tailscale ACL 可進一步限制哪些裝置能連

### Server 綁定設定

```typescript
// server 只監聽 Tailscale IP 或 0.0.0.0 (由 Tailscale firewall 保護)
const HOST = process.env.HOST || '0.0.0.0';
const PORT = parseInt(process.env.PORT || '3000');

// CORS 設定：只允許 Tailscale IP 範圍
const CORS_ORIGINS = [
  /^https?:\/\/100\.\d+\.\d+\.\d+/,  // Tailscale IPv4
  'http://localhost:5173',               // 開發用
];
```

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

### Tool Execution Sandbox

```
所有 AI tool 操作限制在 workspace 目錄內：

允許:
  ✓ /home/user/projects/merak-platform/**
  ✓ /home/user/projects/merak-platform/src/anything.ts

禁止:
  ✗ /home/user/.ssh/id_rsa
  ✗ /etc/passwd
  ✗ ../../../etc/shadow
  ✗ /home/user/projects/other-project/  (不同 workspace)
```

### 路徑驗證

```typescript
function validatePath(workspacePath: string, requestedPath: string): string {
  // 1. Resolve to absolute path
  const absolute = path.resolve(workspacePath, requestedPath);
  
  // 2. 確保在 workspace 內
  if (!absolute.startsWith(workspacePath + path.sep) && absolute !== workspacePath) {
    throw new ForbiddenError('Path traversal detected');
  }
  
  // 3. 檢查是否在 blocklist 中
  const blocked = ['.git', '.env', '.env.local', '.env.production'];
  const relative = path.relative(workspacePath, absolute);
  for (const pattern of blocked) {
    if (relative === pattern || relative.startsWith(pattern + path.sep)) {
      throw new ForbiddenError(`Access to ${pattern} is not allowed`);
    }
  }
  
  return absolute;
}
```

### Terminal 指令白名單

```typescript
const ALLOWED_COMMAND_PREFIXES = [
  'npm ', 'npx ', 'node ', 'yarn ', 'pnpm ',
  'cat ', 'head ', 'tail ', 'grep ', 'find ', 'ls', 'wc ',
  'git status', 'git diff', 'git log', 'git branch', 'git show',
  'tsc', 'eslint', 'prettier',
  'echo ', 'pwd',
];

const BLOCKED_PATTERNS = [
  /rm\s+(-[rf]+\s+)?[\/~]/, // rm -rf / or ~
  /sudo/,
  /su\s/,
  /chmod\s+777/,
  /curl\s/,
  /wget\s/,
  /docker\s/,
  /kubectl\s/,
  />\s*\//, // redirect to root paths
  /\|\s*(bash|sh|zsh)/, // pipe to shell
];

function validateCommand(command: string): boolean {
  // 1. 檢查白名單
  const isAllowed = ALLOWED_COMMAND_PREFIXES.some(
    prefix => command.startsWith(prefix)
  );
  if (!isAllowed) return false;
  
  // 2. 檢查黑名單
  const isBlocked = BLOCKED_PATTERNS.some(
    pattern => pattern.test(command)
  );
  if (isBlocked) return false;
  
  return true;
}
```

## API 安全

### Rate Limiting

```typescript
// 全域 rate limit
app.use(rateLimit({
  windowMs: 60 * 1000,  // 1 分鐘
  max: 120,              // 最多 120 requests/min
  keyGenerator: (req) => req.deviceId, // per-device
}));

// AI chat rate limit (更嚴格)
app.use('/api/chat/send', rateLimit({
  windowMs: 60 * 1000,
  max: 10,               // 最多 10 次 AI 呼叫/min
  keyGenerator: (req) => req.deviceId,
}));

// Git 操作 rate limit
app.use('/api/git', rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => req.deviceId,
}));
```

### Security Headers

```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],  // Tailwind needs inline styles
      connectSrc: ["'self'", "wss:"],           // WebSocket
      imgSrc: ["'self'", "data:"],              // QR code
    }
  },
  hsts: { maxAge: 31536000 },
}));
```

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
ANTHROPIC_API_KEY=sk-ant-...        # Claude API key
JWT_SECRET=random-32-char-string     # JWT 簽名密鑰
VAPID_PUBLIC_KEY=...                 # PWA push notification
VAPID_PRIVATE_KEY=...                # PWA push notification
GITHUB_TOKEN=ghp_...                 # (optional) GitHub API for PR creation
HOST=0.0.0.0
PORT=3000
NODE_ENV=production
DATA_DIR=./data                      # SQLite DB 位置
```

⚠️ `.env` 必須在 `.gitignore` 中，永遠不入 git。
