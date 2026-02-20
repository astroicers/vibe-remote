# API Specification — Vibe Remote

## 總覽

所有 API endpoint 都在 `/api` prefix 下。認證使用 JWT Bearer token。

**Base URL**: `http://{HOST}:{PORT}/api`
- 開發（本機）: `http://localhost:3000/api`（PORT 預設 3000）
- Docker: `http://{TAILSCALE_IP}:8080/api`（docker-compose 預設 8080）

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
- `VALIDATION_ERROR` (400/422) — Request body 驗證失敗
- `INTERNAL_ERROR` (500) — Server 內部錯誤

---

## 1. Auth

> Auth 路由掛在 `/api/auth`。除了 `/me` 和 `/devices` 需要 JWT，其他配對相關 endpoint 不需要認證。

### POST /api/auth/pairing/start
產生 QR code 供手機掃碼配對。

**Request**: 無 body

**Response** `200`:
```json
{
  "code": "a1b2c3",
  "qrCode": "data:image/png;base64,...",
  "expiresAt": "2025-03-01T12:05:00Z"
}
```

**說明**: `code` 為 6 碼配對碼，有效期 5 分鐘。QR code 內容包含 server URL 和 pairing code。

---

### POST /api/auth/pairing/complete
手機掃碼後呼叫，換取 JWT token。

**Request**:
```json
{
  "code": "a1b2c3",
  "deviceName": "iPhone 15 Pro"
}
```

**Validation**: `code` 必須恰好 6 字元，`deviceName` 長度 1-100。

**Response** `200`:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "deviceId": "dev_xxx"
}
```

**Error** `400`:
```json
{
  "error": "Invalid or expired pairing code",
  "code": "PAIRING_FAILED"
}
```

---

### POST /api/auth/dev/quick-pair
開發環境專用，不需要 QR 掃碼即可快速配對。僅在 `NODE_ENV=development` 時可用。

**Request**:
```json
{
  "deviceName": "Dev Device"
}
```

**說明**: `deviceName` 為選填，預設 `"Dev Device"`。

**Response** `200`:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "deviceId": "dev_xxx"
}
```

**Error** `404` (非 development 環境):
```json
{
  "error": "Not found",
  "code": "NOT_FOUND"
}
```

---

### GET /api/auth/me
取得目前認證裝置的資訊。**需要 JWT**。

**Response** `200`:
```json
{
  "id": "dev_xxx",
  "name": "iPhone 15 Pro",
  "last_seen_at": "2025-03-01T10:00:00Z",
  "created_at": "2025-01-15T08:00:00Z"
}
```

---

### GET /api/auth/devices
列出所有已配對裝置。**需要 JWT**。

**Response** `200`:
```json
[
  {
    "id": "dev_xxx",
    "name": "iPhone 15 Pro",
    "last_seen_at": "2025-03-01T10:00:00Z",
    "created_at": "2025-01-15T08:00:00Z"
  }
]
```

---

### DELETE /api/auth/devices/:id
撤銷（刪除）指定裝置。同時刪除該裝置的 push subscriptions。**需要 JWT**。

**Response** `200`:
```json
{
  "success": true
}
```

**Error** `404`:
```json
{
  "error": "Device not found",
  "code": "NOT_FOUND"
}
```

---

## 2. Workspaces

> 所有 workspace 路由都需要 JWT 認證。路由掛在 `/api/workspaces`。

### GET /api/workspaces
列出所有已註冊的 workspace。

**Response** `200`:
```json
[
  {
    "id": "ws_abc123",
    "name": "merak-platform",
    "path": "/home/user/projects/merak-platform",
    "systemPrompt": "...",
    "isActive": 1,
    "created_at": "2025-01-15T08:00:00Z"
  }
]
```

---

### GET /api/workspaces/active
取得目前 active 的 workspace。

> **Deprecated**: 多 workspace 架構下已不建議使用。請改用 `GET /api/workspaces/:id`。

**Response** `200`: 同 workspace 物件

**Error** `404`:
```json
{
  "error": "No active workspace",
  "code": "NO_ACTIVE_WORKSPACE"
}
```

---

### GET /api/workspaces/:id
取得單一 workspace 資訊。

**Response** `200`:
```json
{
  "id": "ws_abc123",
  "name": "merak-platform",
  "path": "/home/user/projects/merak-platform",
  "systemPrompt": "...",
  "isActive": 1,
  "created_at": "2025-01-15T08:00:00Z"
}
```

---

### POST /api/workspaces
註冊新的 workspace。

**Request**:
```json
{
  "path": "/home/user/projects/merak-platform",
  "name": "merak-platform",
  "setActive": true
}
```

**說明**:
- `path` (string, required) — 必須是合法目錄路徑
- `name` (string, optional) — 顯示名稱
- `setActive` (boolean, optional) — 是否設為 active workspace

**Response** `201`: 新建的 workspace 物件

**Error** `400`:
```json
{
  "error": "Path does not exist or is not a directory",
  "code": "REGISTRATION_ERROR"
}
```

---

### POST /api/workspaces/:id/activate
將指定 workspace 設為 active。

> **Deprecated**: 多 workspace 架構下已不建議使用。前端已改為直接帶 workspaceId。

**Response** `200`: 更新後的 workspace 物件

---

### PATCH /api/workspaces/:id
更新 workspace 屬性。

**Request**:
```json
{
  "name": "new-name",
  "systemPrompt": "This project uses TypeScript and..."
}
```

**說明**: `name` 和 `systemPrompt` 皆為選填。

**Response** `200`: 更新後的 workspace 物件

---

### DELETE /api/workspaces/:id
移除 workspace 註冊（不會刪除實際檔案）。

**Response** `200`:
```json
{
  "success": true
}
```

---

### GET /api/workspaces/:id/files
取得檔案樹結構。

**Query Parameters**:
- `depth` (number, default: 5) — 遞迴深度上限

**Response** `200`:
```json
[
  {
    "name": "src",
    "type": "directory",
    "children": [
      {
        "name": "index.ts",
        "type": "file"
      }
    ]
  },
  {
    "name": "package.json",
    "type": "file"
  }
]
```

---

### GET /api/workspaces/:id/files/*
讀取單一檔案內容。URL 的 wildcard 部分為檔案的相對路徑。

**範例**: `GET /api/workspaces/ws_abc123/files/src/index.ts`

**Response** `200`:
```json
{
  "path": "src/index.ts",
  "content": "import express from 'express';\n..."
}
```

**Error** `404`:
```json
{
  "error": "File not found",
  "code": "FILE_ERROR"
}
```

---

### GET /api/workspaces/:id/git/status
取得 Git 狀態（使用 simple-git）。

**Response** `200`:
```json
{
  "current": "feat/rate-limiting",
  "tracking": "origin/feat/rate-limiting",
  "staged": ["src/new-file.ts"],
  "modified": ["src/index.ts"],
  "not_added": ["src/untracked.ts"],
  "ahead": 2,
  "behind": 0
}
```

---

### GET /api/workspaces/:id/git/diff
取得 Git diff 輸出（raw text）。

**Query Parameters**:
- `staged` (string, "true"/"false", default: "false") — 是否只顯示 staged 的 diff

**Response** `200`:
```json
{
  "diff": "diff --git a/src/index.ts b/src/index.ts\n..."
}
```

---

### GET /api/workspaces/:id/git/log
取得最近的 commit 歷史。

**Query Parameters**:
- `count` (number, default: 10) — 返回的 commit 數量

**Response** `200`:
```json
[
  {
    "hash": "abc1234",
    "message": "feat: add rate limiting config",
    "date": "2025-03-01T10:00:00Z",
    "author_name": "user",
    "author_email": "user@example.com"
  }
]
```

---

### GET /api/workspaces/:id/git/branches
列出所有分支。

**Response** `200`:
```json
{
  "current": "feat/rate-limiting",
  "all": ["main", "feat/rate-limiting", "remotes/origin/main"],
  "branches": {
    "main": { "current": false, "commit": "abc123" },
    "feat/rate-limiting": { "current": true, "commit": "def456" }
  }
}
```

---

### POST /api/workspaces/:id/git/stage
暫存指定檔案。

**Request**:
```json
{
  "files": ["src/index.ts", "src/new-file.ts"]
}
```

**Validation**: `files` 為非空字串陣列。

**Response** `200`:
```json
{
  "success": true
}
```

---

### POST /api/workspaces/:id/git/commit
提交已暫存的變更。

**Request**:
```json
{
  "message": "feat: add rate limiting middleware"
}
```

**Validation**: `message` 為非空字串。

**Response** `200`:
```json
{
  "success": true,
  "hash": "def5678"
}
```

---

### POST /api/workspaces/:id/git/push
推送到遠端。

**Request**: 無 body

**Response** `200`:
```json
{
  "success": true
}
```

---

### POST /api/workspaces/:id/git/pull
從遠端拉取。

**Request**: 無 body

**Response** `200`:
```json
{
  "success": true
}
```

---

### POST /api/workspaces/:id/git/checkout
切換或建立分支。

**Request**:
```json
{
  "branch": "feat/new-feature",
  "create": true
}
```

**說明**:
- `branch` (string, required) — 分支名稱
- `create` (boolean, optional) — 是否建立新分支

**Response** `200`:
```json
{
  "success": true
}
```

---

### POST /api/workspaces/:id/git/discard
捨棄指定檔案的變更。

**Request**:
```json
{
  "files": ["src/config.ts"]
}
```

**Validation**: `files` 為非空字串陣列。

**Response** `200`:
```json
{
  "success": true
}
```

---

## 3. Chat / AI

> 所有 chat 路由都需要 JWT 認證。路由掛在 `/api/chat`。
>
> **重要**: 送訊息給 AI 是透過 WebSocket（見第 6 節），不是 REST API。REST API 僅用於管理對話和查詢歷史。

### GET /api/chat/conversations
列出指定 workspace 的對話。

**Query Parameters**:
- `workspaceId` (string, **required**) — 篩選 workspace

**Response** `200`:
```json
[
  {
    "id": "conv_xyz789",
    "title": "Add rate limiting",
    "token_usage": "{\"inputTokens\":2500,...}",
    "created_at": "2025-03-01T10:00:00Z",
    "updated_at": "2025-03-01T10:15:00Z"
  }
]
```

**說明**: 最多返回 50 筆，依 `updated_at DESC` 排序。`token_usage` 為 JSON 字串。

**Error** `400`:
```json
{
  "error": "workspaceId is required",
  "code": "MISSING_WORKSPACE_ID"
}
```

---

### GET /api/chat/conversations/:id
取得對話含完整訊息歷史。

**Response** `200`:
```json
{
  "id": "conv_xyz789",
  "workspace_id": "ws_abc123",
  "title": "Add rate limiting",
  "token_usage": "{...}",
  "created_at": "2025-03-01T10:00:00Z",
  "updated_at": "2025-03-01T10:15:00Z",
  "messages": [
    {
      "id": "msg_aaa111",
      "role": "user",
      "content": "Add rate limiting middleware",
      "tool_calls": null,
      "tool_results": null,
      "created_at": "2025-03-01T10:00:00Z"
    },
    {
      "id": "msg_bbb222",
      "role": "assistant",
      "content": "I'll add rate limiting using express-rate-limit...",
      "tool_calls": [
        {
          "name": "Write",
          "input": { "file_path": "src/middleware/rate-limiter.ts", "content": "..." }
        }
      ],
      "tool_results": null,
      "created_at": "2025-03-01T10:00:15Z"
    }
  ]
}
```

**說明**: `tool_calls` 和 `tool_results` 為 JSON parsed 後的陣列或 null。

---

### POST /api/chat/conversations
建立新對話。

**Request**:
```json
{
  "workspaceId": "ws_abc123",
  "title": "Add rate limiting"
}
```

**說明**:
- `workspaceId` (string, required)
- `title` (string, optional, default: "New Conversation")

**Response** `201`: 新建的 conversation 物件

---

### PATCH /api/chat/conversations/:id
更新對話標題。

**Request**:
```json
{
  "title": "Rate limiting implementation"
}
```

**Validation**: `title` 為非空字串。

**Response** `200`: 更新後的 conversation 物件

---

### DELETE /api/chat/conversations/:id
刪除對話（連同所有訊息）。

**Response** `200`:
```json
{
  "success": true
}
```

---

### GET /api/chat/conversations/:id/export
匯出對話為 Markdown 檔案下載。

**Response** `200`:
- Content-Type: `text/markdown; charset=utf-8`
- Content-Disposition: `attachment; filename="conversation-{id}.md"`
- Body: Markdown 格式的對話內容，包含 token usage、所有訊息、tool calls

---

### GET /api/chat/usage
取得指定 workspace 的 token 使用量統計。

**Query Parameters**:
- `workspaceId` (string, **required**)

**Response** `200`:
```json
{
  "workspace": "merak-platform",
  "usage": {
    "inputTokens": 125000,
    "outputTokens": 45000,
    "cacheReadTokens": 300000,
    "cacheCreationTokens": 180000,
    "costUsd": 2.45,
    "conversationCount": 15
  }
}
```

---

## 4. Diff & Review

> 所有 diff 路由都需要 JWT 認證。路由掛在 `/api/diff`。

### GET /api/diff/current
取得當前 workspace 的 git diff（uncommitted changes）。

**Query Parameters**:
- `workspaceId` (string, **required**)

**Response** `200`:
```json
{
  "workspaceId": "ws_abc123",
  "filesChanged": 3,
  "files": [
    {
      "path": "src/middleware/rate-limiter.ts",
      "status": "added",
      "insertions": 35,
      "deletions": 0
    }
  ],
  "raw": "diff --git a/..."
}
```

---

### GET /api/diff/reviews
列出指定 workspace 的 diff reviews。

**Query Parameters**:
- `workspaceId` (string, **required**)

**Response** `200`: diff review 陣列

---

### GET /api/diff/reviews/:id
取得單一 diff review 詳細資訊。

**Response** `200`:
```json
{
  "id": "review_abc",
  "workspaceId": "ws_abc123",
  "conversationId": "conv_xyz789",
  "status": "pending",
  "files": [
    {
      "path": "src/middleware/rate-limiter.ts",
      "status": "added",
      "insertions": 35,
      "deletions": 0,
      "diff": "@@ -0,0 +1,35 @@\n+import rateLimit..."
    }
  ],
  "comments": [],
  "created_at": "2025-03-01T10:00:00Z"
}
```

---

### POST /api/diff/reviews
建立新的 diff review（從目前的 git diff snapshot）。

**Request**:
```json
{
  "workspaceId": "ws_abc123",
  "conversationId": "conv_xyz789"
}
```

**說明**:
- `workspaceId` (string, required)
- `conversationId` (string, optional) — 關聯的對話 ID

**Response** `201`: 新建的 diff review 物件

---

### GET /api/diff/reviews/:id/files/:filePath
取得指定檔案的 unified diff view。`:filePath` 為 wildcard，支援含 `/` 的路徑。

**範例**: `GET /api/diff/reviews/review_abc/files/src/middleware/rate-limiter.ts`

**Response** `200`:
```json
{
  "file": {
    "path": "src/middleware/rate-limiter.ts",
    "status": "added",
    "insertions": 35,
    "deletions": 0,
    "diff": "..."
  },
  "unifiedView": [
    {
      "type": "add",
      "lineNumber": 1,
      "content": "import rateLimit from 'express-rate-limit';"
    }
  ]
}
```

---

### PATCH /api/diff/reviews/:id/status
更新 diff review 整體狀態。

**Request**:
```json
{
  "status": "approved"
}
```

**Validation**: status 必須為 `"pending"` | `"approved"` | `"rejected"` | `"partial"`。

**Response** `200`: 更新後的 diff review 物件

---

### POST /api/diff/reviews/:id/approve
批次 approve 所有檔案的改動。會 stage 所有變更。

**Request**: 無 body

**Response** `200`: 更新後的 diff review 物件（含已 approve 的檔案）

---

### POST /api/diff/reviews/:id/reject
批次 reject 所有檔案的改動。會 discard 所有變更。

**Request**: 無 body

**Response** `200`: 更新後的 diff review 物件

---

### POST /api/diff/reviews/:id/actions
對個別檔案執行 approve/reject/stage/discard 操作。

**Request**:
```json
{
  "actions": [
    { "path": "src/middleware/rate-limiter.ts", "action": "approve" },
    { "path": "src/config.ts", "action": "reject" }
  ]
}
```

**Validation**: `action` 必須為 `"approve"` | `"reject"` | `"stage"` | `"discard"`。

**Response** `200`:
```json
{
  "review": { "..." },
  "applied": 2,
  "errors": []
}
```

---

### POST /api/diff/reviews/:id/comments
對 diff review 中的檔案新增評論。

**Request**:
```json
{
  "filePath": "src/middleware/rate-limiter.ts",
  "content": "Rate limit 的值應該從環境變數讀取",
  "lineNumber": 15
}
```

**說明**:
- `filePath` (string, required)
- `content` (string, required, min 1 char)
- `lineNumber` (number, optional)

**說明**: author 固定為 `"user"`（由 server 設定）。

**Response** `201`: 新建的 comment 物件

---

## 5. Notifications (Push)

> 路由掛在 `/api/notifications`。`/subscribe` 和 `/unsubscribe` 需要 JWT 認證（透過 `req.device`）。`/status` 和 `/vapid-public-key` 不需要認證。

### GET /api/notifications/status
檢查 push notifications 是否可用（VAPID keys 是否已設定）。

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
訂閱 push notifications。**需要 JWT**。

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

**Error** `503` (VAPID 未設定):
```json
{
  "error": "Push notifications not configured",
  "code": "PUSH_NOT_AVAILABLE"
}
```

---

### DELETE /api/notifications/unsubscribe
取消訂閱 push notifications。**需要 JWT**。

**Response** `200`:
```json
{
  "success": true
}
```

---

## 6. WebSocket Protocol

**連線 URL**: `ws://{HOST}:{PORT}/ws`
- 開發: `ws://localhost:3000/ws`
- Docker: `ws://{TAILSCALE_IP}:8080/ws`
- Client（透過 Vite proxy）: `ws://{window.location.host}/ws`

### 連線流程

1. Client 建立 WebSocket 連線
2. Server 立即發送 `connected` 事件
3. Client 必須發送 `auth` 訊息進行認證
4. 認證成功後才能發送其他訊息

---

### Client → Server Events

#### `auth`
認證。連線後必須先發送此訊息。

```json
{
  "type": "auth",
  "token": "jwt_token_here"
}
```

---

#### `chat_send`
送出訊息給 AI。這是與 AI 對話的**唯一方式**（沒有 REST endpoint）。

```json
{
  "type": "chat_send",
  "workspaceId": "ws_abc123",
  "conversationId": "conv_xyz789",
  "message": "Add rate limiting middleware",
  "selectedFiles": ["src/index.ts", "src/middleware/auth.ts"]
}
```

**說明**:
- `workspaceId` (string, required)
- `conversationId` (string, optional) — 為空時自動建立新對話
- `message` (string, required, min 1 char)
- `selectedFiles` (string[], optional) — 使用者手動選擇要給 AI 看的檔案

**限制**:
- Rate limit: 每個裝置每分鐘最多 10 則訊息
- 每個 conversation 同時只能有一個進行中的 AI 請求
- 全域最多 3 個並行 AI runner

---

#### `chat_retry`
重試對話中最後一個使用者訊息。會建立新對話來執行重試。

```json
{
  "type": "chat_retry",
  "conversationId": "conv_xyz789"
}
```

**說明**: 重試會自動查找該對話的 workspace，不需要額外提供 `workspaceId`。

---

#### `tool_approval_response`
回應工具審批請求（當 permission mode 非 `bypassPermissions` 時）。

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

> **重要**: 所有與對話相關的事件（`chat_*`, `tool_*`, `diff_ready`, `files_skipped`, `conversation_created`）都包含 `workspaceId` 欄位，方便 Client 在多 workspace 環境下路由事件。

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

#### `auth_success`
認證成功。

```json
{
  "type": "auth_success",
  "deviceId": "dev_xxx"
}
```

---

#### `auth_error`
認證失敗。

```json
{
  "type": "auth_error",
  "error": "Invalid token"
}
```

---

#### `conversation_created`
新對話建立（含一般建立和重試建立）。

```json
{
  "type": "conversation_created",
  "workspaceId": "ws_abc123",
  "conversationId": "conv_xyz789"
}
```

**重試時會額外包含**:
```json
{
  "type": "conversation_created",
  "workspaceId": "ws_abc123",
  "conversationId": "conv_new123",
  "isRetry": true,
  "originalConversationId": "conv_xyz789"
}
```

---

#### `chat_start`
AI 開始處理訊息。

```json
{
  "type": "chat_start",
  "workspaceId": "ws_abc123",
  "conversationId": "conv_xyz789"
}
```

---

#### `chat_chunk`
AI streaming 回覆的文字片段。

```json
{
  "type": "chat_chunk",
  "workspaceId": "ws_abc123",
  "conversationId": "conv_xyz789",
  "text": "I'll add rate limiting using "
}
```

---

#### `tool_use`
AI 正在使用工具（Claude Agent SDK tool）。

```json
{
  "type": "tool_use",
  "workspaceId": "ws_abc123",
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
  "workspaceId": "ws_abc123",
  "conversationId": "conv_xyz789",
  "result": { "..." }
}
```

---

#### `tool_approval_request`
工具需要使用者審批（當 permission mode 非 `bypassPermissions` 時）。

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
工具審批已處理的確認。

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
  "workspaceId": "ws_abc123",
  "conversationId": "conv_xyz789",
  "modifiedFiles": ["src/middleware/rate-limiter.ts", "src/index.ts"],
  "tokenUsage": {
    "inputTokens": 2500,
    "outputTokens": 1200,
    "cacheReadTokens": 15000,
    "cacheCreationTokens": 18000,
    "costUsd": 0.121237
  }
}
```

**說明**: `tokenUsage` 包含本次對話回合的 token 使用量和成本（USD）。`modifiedFiles` 為 AI 在此回合中修改的檔案清單。

---

#### `chat_error`
AI 處理錯誤。

```json
{
  "type": "chat_error",
  "workspaceId": "ws_abc123",
  "conversationId": "conv_xyz789",
  "error": "Claude SDK exited with error"
}
```

---

#### `diff_ready`
有新的 diff 可以 review（AI 修改了檔案後自動觸發）。

```json
{
  "type": "diff_ready",
  "workspaceId": "ws_abc123",
  "conversationId": "conv_xyz789",
  "files": ["src/middleware/rate-limiter.ts", "src/index.ts"]
}
```

---

#### `files_skipped`
使用者選擇的 context 檔案因為太大而被跳過。

```json
{
  "type": "files_skipped",
  "workspaceId": "ws_abc123",
  "conversationId": "conv_xyz789",
  "files": ["data/large-file.json (5.2 MB > 1.0 MB)"],
  "reason": "File size exceeds limit"
}
```

---

#### `error`
通用錯誤（非特定於某個對話）。

```json
{
  "type": "error",
  "error": "Not authenticated"
}
```

**常見 error messages**:
- `"Invalid JSON"` — 無法解析訊息
- `"Not authenticated"` — 未認證就發送非 auth 訊息
- `"Rate limit exceeded."` — 超過發訊限制
- `"This conversation is already processing."` — 同一 conversation 重複請求
- `"Too many concurrent sessions. Please wait."` — 全域並行上限
- `"Unknown message type"` — 不認識的 type
- `"Tool approval not found or already processed"` — 無效的審批回應

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

Client 實作了 exponential backoff 自動重連：

```
斷線後自動重連:
  1s → 2s → 4s → 8s → 16s (max 5 attempts)

計算: delay = 1000ms * 2^(attempt - 1)

重連後:
  1. 自動重新發送 auth 訊息
  2. 認證成功後自動發送 pending messages queue
  3. 超過 5 次失敗後觸發 connection_failed 事件
```

---

## 7. Health Check

### GET /api/health
健康檢查端點（不需要認證）。

**Response** `200`:
```json
{
  "status": "ok",
  "timestamp": "2025-03-01T10:00:00Z",
  "version": "0.1.0"
}
```

---

## 8. Tasks

> All task routes require JWT authentication. Routes are mounted at `/api/tasks`.

### GET /api/tasks
List tasks for a workspace.

**Query Parameters**:
- `workspaceId` (string, **required**) -- Filter by workspace

**Response** `200`: Array of task objects

**Error** `400`:
```json
{
  "error": "workspaceId is required",
  "code": "MISSING_WORKSPACE_ID"
}
```

---

### GET /api/tasks/:id
Get a single task by ID.

**Response** `200`: Task object

**Error** `404`:
```json
{
  "error": "Task not found",
  "code": "NOT_FOUND"
}
```

---

### POST /api/tasks
Create a new task.

**Request**:
```json
{
  "workspaceId": "ws_abc123",
  "title": "Add unit tests",
  "description": "Write unit tests for the auth module",
  "priority": "normal",
  "contextFiles": ["src/auth/middleware.ts"]
}
```

**Validation** (zod):
- `workspaceId` (string, required)
- `title` (string, required, min 1 char)
- `description` (string, required, min 1 char)
- `priority` (enum: `"low"` | `"normal"` | `"high"` | `"urgent"`, optional, default `"normal"`)
- `contextFiles` (string[], optional)

**Response** `201`: Newly created task object

**Error** `400`:
```json
{
  "error": "Invalid request: workspaceId, title, and description are required",
  "code": "VALIDATION_ERROR",
  "details": [...]
}
```

---

### PATCH /api/tasks/:id
Update task fields. At least one field must be provided.

**Request**:
```json
{
  "title": "Updated title",
  "description": "Updated description",
  "priority": "high",
  "status": "pending"
}
```

**Validation** (zod, all optional):
- `title` (string, min 1 char)
- `description` (string, min 1 char)
- `priority` (enum: `"low"` | `"normal"` | `"high"` | `"urgent"`)
- `status` (enum: `"pending"` | `"queued"` | `"running"` | `"awaiting_review"` | `"approved"` | `"committed"` | `"completed"` | `"failed"` | `"cancelled"`)

**Response** `200`: Updated task object

**Error** `400`:
```json
{
  "error": "At least one field must be provided",
  "code": "VALIDATION_ERROR"
}
```

**Error** `404`:
```json
{
  "error": "Task not found",
  "code": "NOT_FOUND"
}
```

---

### DELETE /api/tasks/:id
Delete a task. Cannot delete a running task (cancel it first).

**Response** `200`:
```json
{
  "success": true
}
```

**Error** `400` (task is running):
```json
{
  "error": "Cannot delete a running task. Cancel it first.",
  "code": "TASK_RUNNING"
}
```

**Error** `404`:
```json
{
  "error": "Task not found",
  "code": "NOT_FOUND"
}
```

---

### POST /api/tasks/:id/run
Enqueue a task for AI execution. Only tasks with `"pending"` status can be run.

**Request**: No body

**Response** `200`: Task object (status will be updated by the queue)

**Error** `400`:
```json
{
  "error": "Cannot run task with status \"running\". Only pending tasks can be run.",
  "code": "INVALID_STATUS"
}
```

**Error** `404`:
```json
{
  "error": "Task not found",
  "code": "NOT_FOUND"
}
```

---

### POST /api/tasks/:id/cancel
Cancel a pending or running task.

**Request**: No body

**Response** `200`: Updated task object (status set to `"cancelled"`)

**Error** `400`:
```json
{
  "error": "Cannot cancel task with status \"completed\". Only pending or running tasks can be cancelled.",
  "code": "INVALID_STATUS"
}
```

**Error** `404`:
```json
{
  "error": "Task not found",
  "code": "NOT_FOUND"
}
```

**Error** `500`:
```json
{
  "error": "Failed to cancel task",
  "code": "CANCEL_FAILED"
}
```

---

## 9. Templates

> All template routes require JWT authentication. Routes are mounted at `/api/templates`.

### GET /api/templates
List prompt templates (global templates where `workspace_id` is NULL, plus workspace-specific templates).

**Query Parameters**:
- `workspaceId` (string, **required**) -- Returns global templates + templates for this workspace

**Response** `200`: Array of template objects, ordered by `sort_order ASC, created_at ASC`

```json
[
  {
    "id": "tpl_fix_lint",
    "workspace_id": null,
    "name": "Fix lint",
    "content": "Fix all linting errors in the codebase",
    "sort_order": 1,
    "created_at": "2025-03-01T10:00:00Z"
  }
]
```

**Error** `400`:
```json
{
  "error": "workspaceId is required",
  "code": "MISSING_WORKSPACE_ID"
}
```

---

### POST /api/templates
Create a new prompt template.

**Request**:
```json
{
  "workspaceId": "ws_abc123",
  "name": "Fix lint",
  "content": "Fix all linting errors in the codebase"
}
```

**Validation** (zod):
- `workspaceId` (string, optional) -- Omit for global template
- `name` (string, required, min 1 char)
- `content` (string, required, min 1 char)

**Note**: `sort_order` is automatically set to the next available value.

**Response** `201`: Newly created template object

**Error** `400`:
```json
{
  "error": "Invalid request: name and content are required",
  "code": "VALIDATION_ERROR"
}
```

---

### PATCH /api/templates/:id
Update a template. At least one of `name` or `content` must be provided.

**Request**:
```json
{
  "name": "Updated name",
  "content": "Updated content"
}
```

**Validation** (zod, all optional):
- `name` (string, min 1 char)
- `content` (string, min 1 char)

**Response** `200`: Updated template object

**Error** `400`:
```json
{
  "error": "At least one of name or content must be provided",
  "code": "VALIDATION_ERROR"
}
```

**Error** `404`:
```json
{
  "error": "Template not found",
  "code": "NOT_FOUND"
}
```

---

### DELETE /api/templates/:id
Delete a prompt template.

**Response** `200`:
```json
{
  "success": true
}
```

**Error** `404`:
```json
{
  "error": "Template not found",
  "code": "NOT_FOUND"
}
```

---

## Appendix: Not Yet Implemented (Phase 2+)

The following features are planned but do not yet have API endpoints:

- **Terminal** -- PTY terminal remote execution
- **Search** -- Full-text codebase search (ripgrep integration)
- **Image upload** -- Upload images to conversation context
- **Auto commit message** -- AI-generated commit messages
- **PR creation** -- Create GitHub PRs from API
