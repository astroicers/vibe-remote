# Database Design — Vibe Remote

## 總覽

使用 SQLite (via better-sqlite3) 作為唯一資料儲存。

**資料庫檔案位置**: `./data/vibe-remote.db`（可透過 `DATABASE_PATH` 環境變數覆蓋）

**設計原則**:
- 一個 DB 檔案，零維護
- 開啟 WAL mode 允許讀寫並行
- 同步 API（better-sqlite3 本身就是同步的）
- 所有 ID 使用前綴 + timestamp(base36) + 隨機字串（如 `ws_m1abc12def3`），由 `generateId(prefix)` 產生
- 時間一律存 ISO 8601 UTC 字串（`datetime('now')`）
- JSON 欄位用 TEXT 存，application layer 做 parse
- 所有表使用 `CREATE TABLE IF NOT EXISTS`，支持冪等初始化

## 初始化設定

```typescript
// server/src/db/index.ts
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
```

> **Note**: 初始化順序為：開啟 DB → 設定 pragma → 執行 schema → 執行 migrations → 插入 seed data。

## Schema

### devices — 已配對的裝置

```sql
CREATE TABLE IF NOT EXISTS devices (
  id            TEXT PRIMARY KEY,              -- generateId('dev')
  name          TEXT NOT NULL,                 -- 裝置名稱，如 'iPhone 15 Pro'
  public_key    TEXT,                          -- 裝置公鑰（用於驗證）
  last_seen_at  TEXT NOT NULL,                 -- 最後連線時間
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### workspaces — 專案目錄

```sql
CREATE TABLE IF NOT EXISTS workspaces (
  id            TEXT PRIMARY KEY,              -- generateId('ws')
  name          TEXT NOT NULL,                 -- 顯示名稱，如 'merak-platform'
  path          TEXT NOT NULL UNIQUE,          -- 絕對路徑 '/home/user/projects/merak-platform'
  is_active     INTEGER NOT NULL DEFAULT 0,    -- 歷史欄位，多 workspace 模式下已不使用
  system_prompt TEXT,                          -- 專案級別的 AI system prompt
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
```

> **Note**: `is_active` 欄位是早期單一 workspace 模式的遺留。目前多 workspace 模式下不再依賴此欄位，workspace 切換改由 client 端傳入 `workspace_id` 決定。早期設計中的 `git_remote`、`default_branch`、`updated_at` 欄位並未實作 — Git remote 資訊改為即時透過 `simple-git` 讀取。

### conversations — 對話

```sql
CREATE TABLE IF NOT EXISTS conversations (
  id              TEXT PRIMARY KEY,            -- generateId('conv')
  workspace_id    TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title           TEXT,                        -- 由第一則 user message 的前 50 字或 AI 摘要
  token_usage     TEXT,                        -- JSON（見下方結構說明）
  sdk_session_id  TEXT,                        -- Claude Agent SDK session ID for resume
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_conversations_workspace ON conversations(workspace_id);
```

**token_usage JSON 結構**:
```json
{
  "inputTokens": 2500,
  "outputTokens": 1200,
  "cacheReadTokens": 15000,
  "cacheCreationTokens": 18000,
  "costUsd": 0.121237
}
```

**sdk_session_id 用途**:
- 儲存 Claude Agent SDK 的 session ID
- 用於 Session Resume 功能，減少後續對話的 token 消耗
- 第一次對話後儲存，後續對話使用 `resumeSessionId` 參數

### messages — 對話訊息

```sql
CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY,            -- generateId('msg')
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT NOT NULL,               -- 訊息文字內容
  tool_calls      TEXT,                        -- JSON array of tool calls
  tool_results    TEXT,                        -- JSON array of tool results
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
```

> **Note**: 早期設計使用單一 `metadata` JSON 欄位；實際實作改為 `tool_calls` 和 `tool_results` 兩個獨立 TEXT 欄位，分別儲存 JSON array。這樣更方便查詢是否有 tool 使用。

**tool_calls JSON 結構範例**:
```json
[
  {
    "id": "toolu_01abc",
    "name": "file_write",
    "input": {"path": "src/middleware/rate-limiter.ts", "content": "..."}
  }
]
```

**tool_results JSON 結構範例**:
```json
[
  {
    "tool_use_id": "toolu_01abc",
    "content": "File written successfully"
  }
]
```

### tasks -- Task queue (implemented with in-memory queue)

```sql
CREATE TABLE IF NOT EXISTS tasks (
  id            TEXT PRIMARY KEY,              -- generateId('task')
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL,                 -- 自然語言任務描述
  status        TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'awaiting_review', 'approved', 'committed', 'failed')),
  priority      TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  progress      INTEGER,                       -- 0-100 進度百分比
  branch        TEXT,                          -- Git branch name
  depends_on    TEXT,                          -- JSON array of task IDs
  context_files TEXT,                          -- JSON array of file paths
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  started_at    TEXT,                          -- 開始執行時間
  completed_at  TEXT                           -- 完成時間
);

CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
```

> **Note**: `priority` 為 TEXT 而非 INTEGER，使用 CHECK constraint 限制值域。`depends_on` 儲存 JSON array（而非 FK reference），允許多重依賴。Task runner and in-memory queue are implemented in `server/src/tasks/`.

### diff_reviews — Diff 審查

```sql
CREATE TABLE IF NOT EXISTS diff_reviews (
  id              TEXT PRIMARY KEY,            -- generateId('dr')
  conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
  task_id         TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  workspace_id    TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  files_json      TEXT NOT NULL,               -- JSON array of FileDiff objects
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'partial')),
  commit_message  TEXT,                        -- 建議的 commit message
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_diff_reviews_workspace ON diff_reviews(workspace_id);
```

> **Note**: 每筆 diff_review 包含一次 AI 操作所修改的所有檔案，以 `files_json` JSON array 儲存（而非每個檔案一列）。`status` 支持 `partial`，表示部分檔案 approved、部分 rejected。

**files_json JSON 結構範例**:
```json
[
  {
    "path": "src/middleware/rate-limiter.ts",
    "diff": "--- a/src/middleware/rate-limiter.ts\n+++ b/src/middleware/rate-limiter.ts\n...",
    "status": "added"
  },
  {
    "path": "src/index.ts",
    "diff": "--- a/src/index.ts\n+++ b/src/index.ts\n...",
    "status": "modified"
  }
]
```

### diff_comments — Diff 評論

```sql
CREATE TABLE IF NOT EXISTS diff_comments (
  id              TEXT PRIMARY KEY,            -- generateId('dc')
  diff_review_id  TEXT NOT NULL REFERENCES diff_reviews(id) ON DELETE CASCADE,
  file_path       TEXT NOT NULL,               -- 評論針對的檔案
  line_number     INTEGER,                     -- 評論針對的行號（可為 NULL 表示檔案級評論）
  content         TEXT NOT NULL,               -- 評論內容
  author          TEXT NOT NULL CHECK (author IN ('user', 'ai')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
```

> **Note**: `diff_comments` 表支持使用者對 diff 的逐行或逐檔評論，以及 AI 的回覆。`author` 區分評論來源。這些評論可以被送回 AI 作為 re-generation 的 context。

### push_subscriptions — PWA Push Notification 訂閱

```sql
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          TEXT PRIMARY KEY,                -- generateId('push')
  device_id   TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL UNIQUE,            -- Push service endpoint URL
  keys        TEXT NOT NULL,                   -- JSON: { p256dh, auth }
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**keys JSON 結構**:
```json
{
  "p256dh": "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8p8REfXRs",
  "auth": "tBHItJI5svbpC7htLcZ7oQ"
}
```

### prompt_templates — Prompt 範本

```sql
CREATE TABLE IF NOT EXISTS prompt_templates (
  id            TEXT PRIMARY KEY,              -- 如 'tpl_fix_lint'
  workspace_id  TEXT REFERENCES workspaces(id) ON DELETE CASCADE,  -- NULL = global template
  name          TEXT NOT NULL,                 -- 顯示名稱
  content       TEXT NOT NULL,                 -- Prompt 內容
  sort_order    INTEGER NOT NULL DEFAULT 0,    -- 排序用
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_prompt_templates_workspace ON prompt_templates(workspace_id);
```

## Seed Data

初始化時使用 `INSERT OR IGNORE` 插入預設 global prompt templates：

| id | name | content | sort_order |
|----|------|---------|------------|
| `tpl_fix_lint` | Fix lint | Fix all linting errors in the codebase | 1 |
| `tpl_write_tests` | Write tests | Write unit tests for the recent changes | 2 |
| `tpl_refactor` | Refactor | Refactor this code to improve readability and maintainability | 3 |
| `tpl_explain` | Explain | Explain how this code works | 4 |
| `tpl_review` | Review | Review this code and suggest improvements | 5 |

這些 template 的 `workspace_id` 為 NULL（global），所有 workspace 共用。

## Migration 策略

**不使用**獨立的 `migrations/` 目錄或 `.sql` 檔案。Migration 邏輯直接寫在 `server/src/db/index.ts` 的 `runMigrations()` 函式中。

**初始化流程**（`initDb()`）:

1. 確保資料庫目錄存在
2. 開啟 SQLite 連線
3. 設定 `PRAGMA journal_mode = WAL` 和 `PRAGMA foreign_keys = ON`
4. 執行 `schema.ts` 中的 `SCHEMA`（全部使用 `CREATE TABLE IF NOT EXISTS`，冪等執行）
5. 執行 `runMigrations(db)` — 對既有資料庫做 schema 變更
6. 執行 `SEED_DATA`（使用 `INSERT OR IGNORE`，冪等執行）

**Migration 範例**（針對已存在的資料庫新增欄位）:

```typescript
function runMigrations(database: Database.Database): void {
  // Migration 1: Add sdk_session_id to conversations
  const hasSessionIdColumn = database
    .prepare("SELECT COUNT(*) as count FROM pragma_table_info('conversations') WHERE name = 'sdk_session_id'")
    .get() as { count: number };

  if (hasSessionIdColumn.count === 0) {
    database.exec('ALTER TABLE conversations ADD COLUMN sdk_session_id TEXT');
    console.log('Migration: Added sdk_session_id column to conversations');
  }
}
```

**新增 migration 的方式**: 在 `runMigrations()` 函式中加入新的 column 檢查和 `ALTER TABLE` 語句。每次 migration 先檢查欄位是否已存在，確保冪等性。

## 常用查詢模式

### 取得 workspace 列表

```sql
SELECT id, name, path, system_prompt, created_at
FROM workspaces
ORDER BY created_at DESC;
```

### 取得特定 workspace 的對話列表（最新的在前）

```sql
SELECT c.id, c.workspace_id, c.title,
       COUNT(m.id) as message_count,
       c.token_usage,
       c.sdk_session_id,
       c.created_at, c.updated_at
FROM conversations c
LEFT JOIN messages m ON m.conversation_id = c.id
WHERE c.workspace_id = ?
GROUP BY c.id
ORDER BY c.updated_at DESC
LIMIT ? OFFSET ?;
```

### 取得對話的所有訊息

```sql
SELECT id, role, content, tool_calls, tool_results, created_at
FROM messages
WHERE conversation_id = ?
ORDER BY created_at ASC;
```

### 取得 workspace 的 pending diff reviews

```sql
SELECT dr.id, dr.files_json, dr.status, dr.commit_message,
       dr.conversation_id, dr.created_at
FROM diff_reviews dr
WHERE dr.workspace_id = ?
  AND dr.status = 'pending'
ORDER BY dr.created_at DESC;
```

### 取得 diff review 的評論

```sql
SELECT id, file_path, line_number, content, author, created_at
FROM diff_comments
WHERE diff_review_id = ?
ORDER BY file_path, line_number, created_at;
```

### 取得 task queue（按優先序）

```sql
SELECT *
FROM tasks
WHERE workspace_id = ?
ORDER BY
  CASE status
    WHEN 'running' THEN 0
    WHEN 'awaiting_review' THEN 1
    WHEN 'queued' THEN 2
    WHEN 'approved' THEN 3
    WHEN 'committed' THEN 4
    WHEN 'failed' THEN 5
  END,
  CASE priority
    WHEN 'urgent' THEN 0
    WHEN 'high' THEN 1
    WHEN 'normal' THEN 2
    WHEN 'low' THEN 3
  END,
  created_at ASC;
```

### 取得裝置的 push subscriptions

```sql
SELECT ps.endpoint, ps.keys
FROM push_subscriptions ps
JOIN devices d ON ps.device_id = d.id
WHERE d.id = ?;
```

## 完整索引列表

| 索引名稱 | 表 | 欄位 |
|----------|-----|------|
| `idx_conversations_workspace` | conversations | workspace_id |
| `idx_messages_conversation` | messages | conversation_id |
| `idx_tasks_workspace` | tasks | workspace_id |
| `idx_tasks_status` | tasks | status |
| `idx_diff_reviews_workspace` | diff_reviews | workspace_id |
| `idx_prompt_templates_workspace` | prompt_templates | workspace_id |

## 備份

SQLite 檔案可以直接 copy。建議：

```bash
# 安全備份（不會被 WAL 影響）
sqlite3 data/vibe-remote.db ".backup data/backup-$(date +%Y%m%d).db"
```

可以設定 cron job 每天備份。
