# API Specification — Vibe Remote

## 總覽

所有 API endpoint 都在 `/api` prefix 下。認證使用 JWT Bearer token。

**Base URL**: `https://{TAILSCALE_IP}:3000/api`

**認證 Header**: `Authorization: Bearer {jwt_token}`

**通用 Error Response**:
```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

**通用 Error Codes**:
- `UNAUTHORIZED` (401) — JWT 無效或過期
- `FORBIDDEN` (403) — 權限不足
- `NOT_FOUND` (404) — 資源不存在
- `VALIDATION_ERROR` (422) — Request body 驗證失敗
- `INTERNAL_ERROR` (500) — Server 內部錯誤

---

## 1. Auth

### POST /api/auth/setup
產生 QR code 供手機掃碼配對。在 server 端（電腦瀏覽器）操作。

**Request**: 無（需要在 server 本機或已認證的 session 中呼叫）

**Response** `200`:
```json
{
  "qrCode": "data:image/png;base64,...",
  "pairingCode": "a1b2c3d4",
  "expiresAt": "2025-03-01T12:05:00Z"
}
```

**說明**: pairingCode 有效期 5 分鐘。QR code 內容為 `vibe-remote://pair?code={pairingCode}&server={tailscale_ip}:3000`

---

### POST /api/auth/pair
手機掃碼後呼叫，換取 JWT token。

**Request**:
```json
{
  "pairingCode": "a1b2c3d4",
  "deviceName": "iPhone 15 Pro",
  "deviceId": "unique-device-fingerprint"
}
```

**Response** `200`:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "refresh-token-string",
  "expiresIn": 604800
}
```

**Error** `401`:
```json
{
  "error": "Invalid or expired pairing code",
  "code": "INVALID_PAIRING_CODE"
}
```

---

### POST /api/auth/refresh
更新過期的 JWT token。

**Request**:
```json
{
  "refreshToken": "refresh-token-string"
}
```

**Response** `200`:
```json
{
  "token": "new-jwt-token",
  "refreshToken": "new-refresh-token",
  "expiresIn": 604800
}
```

---

## 2. Workspaces

### GET /api/workspaces
列出所有已註冊的 workspace。

**Response** `200`:
```json
{
  "workspaces": [
    {
      "id": "ws_abc123",
      "name": "merak-platform",
      "path": "/home/user/projects/merak-platform",
      "gitRemote": "git@github.com:user/merak-platform.git",
      "defaultBranch": "main",
      "status": {
        "currentBranch": "feat/rate-limiting",
        "isDirty": true,
        "uncommittedFiles": 3,
        "ahead": 2,
        "behind": 0
      },
      "isActive": true,
      "createdAt": "2025-01-15T08:00:00Z"
    }
  ]
}
```

---

### POST /api/workspaces
註冊新的 workspace。

**Request**:
```json
{
  "name": "merak-platform",
  "path": "/home/user/projects/merak-platform",
  "defaultBranch": "main",
  "systemPrompt": "This is a zero-trust platform using OpenZiti and Keycloak..."
}
```

**Response** `201`:
```json
{
  "id": "ws_abc123",
  "name": "merak-platform",
  "path": "/home/user/projects/merak-platform",
  "gitRemote": "git@github.com:user/merak-platform.git",
  "defaultBranch": "main",
  "createdAt": "2025-01-15T08:00:00Z"
}
```

**Validation**: path 必須存在且是一個 git repo。

---

### GET /api/workspaces/:id
取得單一 workspace 詳細資訊，包含 git status。

**Response** `200`:
```json
{
  "id": "ws_abc123",
  "name": "merak-platform",
  "path": "/home/user/projects/merak-platform",
  "gitRemote": "git@github.com:user/merak-platform.git",
  "defaultBranch": "main",
  "systemPrompt": "...",
  "status": {
    "currentBranch": "feat/rate-limiting",
    "isDirty": true,
    "staged": ["src/middleware/rate-limiter.ts"],
    "unstaged": ["src/index.ts", "package.json"],
    "untracked": [],
    "ahead": 2,
    "behind": 0,
    "lastCommit": {
      "hash": "abc1234",
      "message": "feat: add rate limiting config",
      "author": "user",
      "date": "2025-03-01T10:00:00Z"
    }
  },
  "recentCommits": [
    {
      "hash": "abc1234",
      "message": "feat: add rate limiting config",
      "date": "2025-03-01T10:00:00Z"
    }
  ]
}
```

---

### GET /api/workspaces/:id/tree
取得檔案樹結構。

**Query Parameters**:
- `depth` (number, default: 3) — 遞迴深度
- `path` (string, default: "/") — 起始路徑

**Response** `200`:
```json
{
  "tree": [
    {
      "name": "src",
      "type": "directory",
      "children": [
        {
          "name": "index.ts",
          "type": "file",
          "size": 1234
        },
        {
          "name": "middleware",
          "type": "directory",
          "children": [
            {
              "name": "rate-limiter.ts",
              "type": "file",
              "size": 567
            }
          ]
        }
      ]
    },
    {
      "name": "package.json",
      "type": "file",
      "size": 890
    }
  ]
}
```

---

### GET /api/workspaces/:id/file
讀取單一檔案內容。

**Query Parameters**:
- `path` (string, required) — 相對於 workspace root 的檔案路徑

**Response** `200`:
```json
{
  "path": "src/middleware/rate-limiter.ts",
  "content": "import express from 'express';\n...",
  "language": "typescript",
  "size": 567,
  "lastModified": "2025-03-01T10:00:00Z"
}
```

---

### GET /api/workspaces/:id/search
全文搜尋 codebase（使用 ripgrep 或 grep）。

**Query Parameters**:
- `q` (string, required) — 搜尋關鍵字
- `filePattern` (string, optional) — 檔案 glob pattern，例如 `*.ts`
- `maxResults` (number, default: 50)

**Response** `200`:
```json
{
  "query": "rate-limit",
  "results": [
    {
      "file": "src/middleware/rate-limiter.ts",
      "line": 15,
      "content": "  const rateLimitConfig = getRateLimitConfig();",
      "beforeContext": ["", "export function createRateLimiter() {"],
      "afterContext": ["  const limiter = rateLimit(rateLimitConfig);", ""]
    }
  ],
  "totalMatches": 8
}
```

---

## 3. Chat / AI

### POST /api/chat/send
送出訊息給 AI。回覆通過 WebSocket streaming 返回。

**Request**:
```json
{
  "workspaceId": "ws_abc123",
  "conversationId": "conv_xyz789",
  "message": "Add rate limiting middleware to the API gateway",
  "contextFiles": [
    "src/index.ts",
    "src/middleware/auth.ts"
  ],
  "templateId": null,
  "images": []
}
```

**說明**：
- `conversationId` 為 null 時建立新對話
- `contextFiles` 是使用者手動選擇要給 AI 看的檔案
- `images` 是 base64 encoded 圖片陣列

**Response** `202`:
```json
{
  "conversationId": "conv_xyz789",
  "messageId": "msg_aaa111",
  "status": "streaming"
}
```

實際 AI 回覆通過 WebSocket `ai_chunk` event 串流返回（見 WebSocket 章節）。

---

### GET /api/chat/conversations
列出對話。

**Query Parameters**:
- `workspaceId` (string, optional) — 篩選特定 workspace 的對話
- `limit` (number, default: 20)
- `offset` (number, default: 0)

**Response** `200`:
```json
{
  "conversations": [
    {
      "id": "conv_xyz789",
      "workspaceId": "ws_abc123",
      "title": "Add rate limiting",
      "messageCount": 12,
      "createdAt": "2025-03-01T10:00:00Z",
      "updatedAt": "2025-03-01T10:15:00Z"
    }
  ],
  "total": 42
}
```

---

### GET /api/chat/conversations/:id
取得完整對話歷史。

**Response** `200`:
```json
{
  "id": "conv_xyz789",
  "workspaceId": "ws_abc123",
  "title": "Add rate limiting",
  "messages": [
    {
      "id": "msg_aaa111",
      "role": "user",
      "content": "Add rate limiting middleware to the API gateway",
      "metadata": {
        "contextFiles": ["src/index.ts"],
        "voiceInput": false
      },
      "createdAt": "2025-03-01T10:00:00Z"
    },
    {
      "id": "msg_bbb222",
      "role": "assistant",
      "content": "I'll add rate limiting using express-rate-limit...",
      "metadata": {
        "toolCalls": [
          {
            "tool": "file_write",
            "args": {"path": "src/middleware/rate-limiter.ts"},
            "result": "success"
          }
        ],
        "filesModified": ["src/middleware/rate-limiter.ts", "src/index.ts"],
        "tokensUsed": {"input": 2500, "output": 1200}
      },
      "createdAt": "2025-03-01T10:00:15Z"
    }
  ]
}
```

---

### DELETE /api/chat/conversations/:id
刪除對話。

**Response** `204`: No content

---

### POST /api/chat/upload-image
上傳圖片到對話 context（截圖 bug、架構圖等）。

**Request**: `multipart/form-data`
- `image` (file) — 圖片檔案 (PNG/JPEG, max 5MB)

**Response** `200`:
```json
{
  "imageId": "img_ccc333",
  "url": "/api/chat/images/img_ccc333",
  "size": 245000,
  "mimeType": "image/png"
}
```

---

## 4. Diff & Review

### GET /api/diff/:workspaceId
取得當前 workspace 的 diff（uncommitted changes）。

**Response** `200`:
```json
{
  "workspaceId": "ws_abc123",
  "branch": "feat/rate-limiting",
  "summary": {
    "filesChanged": 3,
    "insertions": 45,
    "deletions": 12
  },
  "files": [
    {
      "path": "src/middleware/rate-limiter.ts",
      "status": "added",
      "insertions": 35,
      "deletions": 0,
      "hunks": [
        {
          "header": "@@ -0,0 +1,35 @@",
          "changes": [
            {"type": "add", "lineNumber": 1, "content": "import rateLimit from 'express-rate-limit';"},
            {"type": "add", "lineNumber": 2, "content": ""},
            {"type": "add", "lineNumber": 3, "content": "export function createRateLimiter() {"}
          ]
        }
      ],
      "reviewStatus": "pending"
    },
    {
      "path": "src/index.ts",
      "status": "modified",
      "insertions": 8,
      "deletions": 2,
      "hunks": [
        {
          "header": "@@ -15,6 +15,12 @@",
          "changes": [
            {"type": "context", "lineNumber": 15, "content": "const app = express();"},
            {"type": "del", "lineNumber": 16, "content": "app.use(cors());"},
            {"type": "add", "lineNumber": 16, "content": "app.use(cors());"},
            {"type": "add", "lineNumber": 17, "content": "app.use(createRateLimiter());"}
          ]
        }
      ],
      "reviewStatus": "pending"
    }
  ]
}
```

---

### POST /api/diff/:workspaceId/approve
Approve 指定檔案的改動。

**Request**:
```json
{
  "files": ["src/middleware/rate-limiter.ts"]
}
```

**Response** `200`:
```json
{
  "approved": ["src/middleware/rate-limiter.ts"],
  "remaining": 2
}
```

---

### POST /api/diff/:workspaceId/reject
Reject 指定檔案並附上回饋。被 reject 的檔案會 revert 改動。

**Request**:
```json
{
  "files": ["src/config.ts"],
  "comment": "Rate limit 的值應該從環境變數讀取，不要 hardcode"
}
```

**Response** `200`:
```json
{
  "rejected": ["src/config.ts"],
  "reverted": true,
  "feedbackSentToAI": true,
  "newConversationMessageId": "msg_ddd444"
}
```

**說明**: Reject 時 comment 會自動送回 AI 作為新一輪對話，AI 會根據回饋重新修改。

---

### POST /api/diff/:workspaceId/approve-all
批次 approve 所有 pending 的檔案。

**Response** `200`:
```json
{
  "approved": ["src/middleware/rate-limiter.ts", "src/index.ts", "src/config.ts"],
  "remaining": 0
}
```

---

## 5. Git Operations

### POST /api/git/:workspaceId/commit

**Request**:
```json
{
  "message": "feat: add rate limiting middleware",
  "autoMessage": true
}
```

**說明**: `autoMessage: true` 時，server 會呼叫 AI 根據 diff 自動產生 commit message，忽略 `message` 欄位。

**Response** `200`:
```json
{
  "hash": "def5678",
  "message": "feat: add rate limiting middleware\n\n- Add express-rate-limit package\n- Configure 100 requests per 15 minutes\n- Apply to all API routes",
  "filesCommitted": 3
}
```

---

### POST /api/git/:workspaceId/push

**Request**:
```json
{
  "remote": "origin",
  "branch": "feat/rate-limiting",
  "force": false
}
```

**Response** `200`:
```json
{
  "pushed": true,
  "remote": "origin",
  "branch": "feat/rate-limiting",
  "commits": 3
}
```

---

### POST /api/git/:workspaceId/pull

**Response** `200`:
```json
{
  "pulled": true,
  "changes": {
    "filesChanged": 5,
    "insertions": 120,
    "deletions": 30
  },
  "conflicts": []
}
```

---

### POST /api/git/:workspaceId/branch

**Request**:
```json
{
  "action": "create",
  "name": "feat/rbac-permissions",
  "from": "main"
}
```

**說明**: `action` 可以是 `create`、`switch`、`delete`。

**Response** `200`:
```json
{
  "action": "create",
  "branch": "feat/rbac-permissions",
  "from": "main",
  "switched": true
}
```

---

### POST /api/git/:workspaceId/pr

**Request**:
```json
{
  "title": "feat: add rate limiting middleware",
  "body": "",
  "autoBody": true,
  "baseBranch": "main",
  "draft": false
}
```

**Response** `201`:
```json
{
  "prNumber": 42,
  "url": "https://github.com/user/merak-platform/pull/42",
  "title": "feat: add rate limiting middleware",
  "body": "## Changes\n- Add rate limiting...",
  "status": "open"
}
```

---

### POST /api/git/:workspaceId/discard

**Request**:
```json
{
  "files": ["src/config.ts"],
  "confirm": true
}
```

**說明**: `files` 為空陣列表示 discard all。`confirm` 必須為 `true`（防止誤操作）。

**Response** `200`:
```json
{
  "discarded": ["src/config.ts"],
  "remaining": 2
}
```

---

## 6. Tasks (Phase 2)

### GET /api/tasks

**Query Parameters**:
- `workspaceId` (string, optional)
- `status` (string, optional) — `queued|running|awaiting_review|approved|committed|failed`

**Response** `200`:
```json
{
  "tasks": [
    {
      "id": "task_eee555",
      "workspaceId": "ws_abc123",
      "title": "Add rate limiting",
      "description": "Add rate limiting middleware to the API gateway, 100 req/15min",
      "status": "awaiting_review",
      "priority": 1,
      "branchName": "vibe/task-eee555-rate-limiting",
      "dependsOn": null,
      "diffSummary": {
        "filesChanged": 3,
        "insertions": 45,
        "deletions": 12
      },
      "createdAt": "2025-03-01T07:30:00Z",
      "updatedAt": "2025-03-01T07:45:00Z"
    }
  ]
}
```

---

### POST /api/tasks

**Request**:
```json
{
  "workspaceId": "ws_abc123",
  "title": "Add rate limiting",
  "description": "Add rate limiting middleware to the API gateway. Use express-rate-limit, configure 100 requests per 15 minutes per IP.",
  "priority": 1,
  "dependsOn": null,
  "contextFiles": ["src/index.ts"]
}
```

**Response** `201`:
```json
{
  "id": "task_eee555",
  "status": "queued",
  "branchName": "vibe/task-eee555-rate-limiting",
  "estimatedDuration": "2-5 minutes"
}
```

---

### POST /api/tasks/batch
批次建立多個 tasks（支援依賴關係）。

**Request**:
```json
{
  "workspaceId": "ws_abc123",
  "tasks": [
    {
      "tempId": "t1",
      "title": "Design RBAC model",
      "description": "Write design doc for RBAC permission model...",
      "priority": 1,
      "dependsOn": null
    },
    {
      "tempId": "t2",
      "title": "Create DB migrations",
      "description": "Based on the design doc, create migration files...",
      "priority": 2,
      "dependsOn": "t1"
    },
    {
      "tempId": "t3",
      "title": "Implement RBAC service",
      "description": "Implement the RBAC service with CRUD API...",
      "priority": 3,
      "dependsOn": "t2"
    }
  ]
}
```

**Response** `201`:
```json
{
  "tasks": [
    {"id": "task_111", "tempId": "t1", "status": "queued"},
    {"id": "task_222", "tempId": "t2", "status": "queued", "dependsOn": "task_111"},
    {"id": "task_333", "tempId": "t3", "status": "queued", "dependsOn": "task_222"}
  ]
}
```

---

### PATCH /api/tasks/:id
更新 task 狀態。

**Request**:
```json
{
  "status": "approved"
}
```

**Response** `200`:
```json
{
  "id": "task_eee555",
  "status": "approved",
  "updatedAt": "2025-03-01T08:00:00Z"
}
```

---

### POST /api/tasks/:id/retry
重試失敗的 task。

**Response** `200`:
```json
{
  "id": "task_eee555",
  "status": "queued",
  "retryCount": 1
}
```

---

## 7. Terminal

### POST /api/terminal/run
執行預定義指令。

**Request**:
```json
{
  "workspaceId": "ws_abc123",
  "command": "test"
}
```

**允許的 commands**: `test`, `lint`, `build`, `typecheck`, `install`

這些會對應到 workspace 的 package.json scripts:
- `test` → `npm test`
- `lint` → `npm run lint`
- `build` → `npm run build`
- `typecheck` → `npm run typecheck`
- `install` → `npm install`

**Response** `202`:
```json
{
  "executionId": "exec_fff666",
  "command": "npm test",
  "status": "running"
}
```

終端輸出通過 WebSocket `terminal_output` event 即時串流。

---

### GET /api/terminal/output/:executionId

**Response** `200`:
```json
{
  "executionId": "exec_fff666",
  "command": "npm test",
  "status": "completed",
  "exitCode": 0,
  "output": "PASS src/__tests__/rate-limiter.test.ts\n  ✓ should limit requests (5ms)\n  ✓ should reset after window (15ms)\n\nTest Suites: 1 passed, 1 total\nTests: 2 passed, 2 total",
  "duration": 3200,
  "startedAt": "2025-03-01T10:00:00Z",
  "completedAt": "2025-03-01T10:00:03Z"
}
```

---

## 8. Templates

### GET /api/templates

**Query Parameters**:
- `workspaceId` (string, optional) — 也會包含 global templates

**Response** `200`:
```json
{
  "templates": [
    {
      "id": "tpl_ggg777",
      "workspaceId": null,
      "name": "Fix lint errors",
      "template": "Fix all lint errors in the current workspace. Run the linter first, then fix each error.",
      "category": "maintenance",
      "createdAt": "2025-01-15T08:00:00Z"
    },
    {
      "id": "tpl_hhh888",
      "workspaceId": "ws_abc123",
      "name": "Add API endpoint",
      "template": "Add a new REST API endpoint for {resource}. Include: route handler, validation with zod, error handling, and unit tests.",
      "category": "feature",
      "createdAt": "2025-02-01T08:00:00Z"
    }
  ]
}
```

---

### POST /api/templates

**Request**:
```json
{
  "workspaceId": null,
  "name": "Write tests",
  "template": "Write comprehensive unit tests for the recently modified files. Use jest and follow existing test patterns.",
  "category": "testing"
}
```

**Response** `201`: 同上格式。

---

## 9. Notifications (Push)

### GET /api/notifications/status
檢查 push notifications 是否可用。

**Response** `200`:
```json
{
  "available": true
}
```

---

### GET /api/notifications/vapid-public-key
取得 VAPID public key 供客戶端訂閱。

**Response** `200`:
```json
{
  "publicKey": "BNx..."
}
```

**Error** `503`:
```json
{
  "error": "Push notifications not configured",
  "code": "PUSH_NOT_AVAILABLE"
}
```

---

### POST /api/notifications/subscribe
訂閱 push notifications。

**Request**:
```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/...",
  "keys": {
    "p256dh": "...",
    "auth": "..."
  }
}
```

**Response** `200`:
```json
{
  "success": true,
  "subscriptionId": "push_abc123"
}
```

---

### DELETE /api/notifications/unsubscribe
取消訂閱 push notifications。

**Response** `200`:
```json
{
  "success": true
}
```

---

## 10. WebSocket Protocol

**連線**: `wss://{TAILSCALE_IP}:3000/ws`

### 認證

連線後必須先發送 `auth` 訊息：

```json
{
  "type": "auth",
  "token": "jwt_token_here"
}
```

成功回應：
```json
{
  "type": "auth_success",
  "deviceId": "dev_xxx"
}
```

失敗回應：
```json
{
  "type": "auth_error",
  "error": "Invalid token"
}
```

---

### Client → Server Events

#### `chat_send`
送出訊息給 AI。

```json
{
  "type": "chat_send",
  "conversationId": "conv_xyz789",
  "message": "Add rate limiting middleware",
  "selectedFiles": ["src/index.ts"]
}
```

**說明**: `conversationId` 為空時會建立新對話。

---

#### `chat_retry`
重試對話中最後一個使用者訊息。會建立新對話來執行重試。

```json
{
  "type": "chat_retry",
  "conversationId": "conv_xyz789"
}
```

---

#### `tool_approval_response`
回應工具審批請求（當 permission mode 非 bypassPermissions 時）。

```json
{
  "type": "tool_approval_response",
  "toolId": "tool_abc123",
  "approved": true,
  "modifiedInput": null,
  "reason": null
}
```

**說明**:
- `approved: true` — 批准工具執行
- `approved: false` — 拒絕工具執行，`reason` 提供拒絕原因
- `modifiedInput` — 可選，修改後的工具輸入參數

---

#### `ping`
心跳。Server 回覆 `pong`。

```json
{
  "type": "ping"
}
```

---

### Server → Client Events

#### `connected`
連線成功後立即發送。

```json
{
  "type": "connected",
  "timestamp": "2025-03-01T10:00:00Z",
  "message": "Welcome to Vibe Remote"
}
```

---

#### `conversation_created`
新對話建立。

```json
{
  "type": "conversation_created",
  "conversationId": "conv_xyz789",
  "isRetry": false,
  "originalConversationId": null
}
```

**說明**: `isRetry: true` 時表示這是重試對話，`originalConversationId` 為原始對話 ID。

---

#### `chat_start`
AI 開始處理訊息。

```json
{
  "type": "chat_start",
  "conversationId": "conv_xyz789"
}
```

---

#### `chat_chunk`

AI streaming 回覆的文字片段。

```json
{
  "type": "chat_chunk",
  "conversationId": "conv_xyz789",
  "text": "I'll add rate limiting using "
}
```

---

#### `tool_use`

AI 正在使用工具。

```json
{
  "type": "tool_use",
  "conversationId": "conv_xyz789",
  "tool": "Edit",
  "input": {
    "file_path": "src/middleware/rate-limiter.ts",
    "old_string": "...",
    "new_string": "..."
  }
}
```

---

#### `tool_result`

工具執行結果。

```json
{
  "type": "tool_result",
  "conversationId": "conv_xyz789",
  "result": { ... }
}
```

---

#### `tool_approval_request`

工具需要使用者審批（當 permission mode 非 bypassPermissions 時）。

```json
{
  "type": "tool_approval_request",
  "toolId": "tool_abc123",
  "conversationId": "conv_xyz789",
  "tool": {
    "name": "Bash",
    "input": { "command": "npm test" },
    "description": "Execute Command",
    "risk": "high"
  }
}
```

**說明**: Client 應顯示審批 modal，使用者決定後發送 `tool_approval_response`。

---

#### `tool_approval_confirmed`

工具審批已處理。

```json
{
  "type": "tool_approval_confirmed",
  "toolId": "tool_abc123",
  "approved": true
}
```

---

#### `chat_complete`

AI 回覆完成。

```json
{
  "type": "chat_complete",
  "conversationId": "conv_xyz789",
  "modifiedFiles": ["src/middleware/rate-limiter.ts"],
  "tokenUsage": {
    "inputTokens": 2500,
    "outputTokens": 1200,
    "cacheReadTokens": 15000,
    "cacheCreationTokens": 18000,
    "costUsd": 0.121237
  }
}
```

**說明**: `tokenUsage` 包含本次對話的 token 使用量和成本（USD）。

---

#### `chat_error`

AI 處理錯誤。

```json
{
  "type": "chat_error",
  "conversationId": "conv_xyz789",
  "error": "Claude CLI exited with code 1"
}
```

---

#### `diff_ready`

有新的 diff 可以 review（AI 修改了檔案）。

```json
{
  "type": "diff_ready",
  "conversationId": "conv_xyz789",
  "files": ["src/middleware/rate-limiter.ts", "src/index.ts"]
}
```

---

#### `task_status`

Task 狀態變更（Phase 2）。

```json
{
  "type": "task_status",
  "taskId": "task_eee555",
  "oldStatus": "running",
  "newStatus": "awaiting_review",
  "diffSummary": {
    "filesChanged": 3,
    "insertions": 45,
    "deletions": 12
  }
}
```

---

#### `terminal_output`

Terminal 指令的即時輸出。

```json
{
  "type": "terminal_output",
  "executionId": "exec_fff666",
  "chunk": "PASS src/__tests__/rate-limiter.test.ts\n",
  "done": false
}
```

---

#### `notification`

通用通知（push notification 也會同時觸發）。

```json
{
  "type": "notification",
  "notificationType": "task_complete",
  "title": "Task completed",
  "body": "Add rate limiting — ready for review",
  "taskId": "task_eee555",
  "timestamp": "2025-03-01T07:45:00Z"
}
```

---

#### `file_changed`

Workspace 中有檔案變更（by file watcher）。

```json
{
  "type": "file_changed",
  "workspaceId": "ws_abc123",
  "changeType": "modify",
  "path": "src/index.ts"
}
```

---

#### `error`

通用錯誤。

```json
{
  "type": "error",
  "error": "Unknown message type"
}
```

---

#### `pong`

心跳回應。

```json
{
  "type": "pong"
}
```

---

### 重連策略

```
斷線後自動重連:
  1s → 2s → 4s → 8s → 16s → 30s (max)
  
重連後:
  1. 重新發送 subscribe_workspace
  2. 重新同步最新狀態 (REST GET)
```
