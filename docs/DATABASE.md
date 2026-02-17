# Database Design — Vibe Remote

## 總覽

使用 SQLite (via better-sqlite3) 作為唯一資料儲存。

**資料庫檔案位置**: `data/vibe-remote.db`

**設計原則**:
- 一個 DB 檔案，零維護
- 開啟 WAL mode 允許讀寫並行
- 同步 API（better-sqlite3 本身就是同步的）
- 所有 ID 使用 nanoid（前綴 + 隨機字串，如 `ws_abc123`）
- 時間一律存 ISO 8601 UTC 字串
- JSON 欄位用 TEXT 存，application layer 做 parse

## 初始化設定

```sql
-- 每次啟動時執行
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
```

## Schema

### workspaces — 專案目錄

```sql
CREATE TABLE workspaces (
  id            TEXT PRIMARY KEY,           -- 'ws_' + nanoid(12)
  name          TEXT NOT NULL,              -- 顯示名稱，如 'merak-platform'
  path          TEXT NOT NULL UNIQUE,       -- 絕對路徑 '/home/user/projects/merak-platform'
  git_remote    TEXT,                       -- 'git@github.com:user/merak-platform.git'
  default_branch TEXT NOT NULL DEFAULT 'main',
  system_prompt TEXT,                       -- 專案級別的 AI system prompt
  is_active     INTEGER NOT NULL DEFAULT 0, -- boolean: 當前 active workspace
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 確保只有一個 active workspace
CREATE UNIQUE INDEX idx_workspaces_active 
  ON workspaces(is_active) WHERE is_active = 1;
```

### conversations — 對話

```sql
CREATE TABLE conversations (
  id            TEXT PRIMARY KEY,           -- 'conv_' + nanoid(12)
  workspace_id  TEXT NOT NULL,
  title         TEXT,                       -- 由第一則 user message 的前 50 字或 AI 摘要
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX idx_conversations_workspace ON conversations(workspace_id);
CREATE INDEX idx_conversations_updated ON conversations(updated_at DESC);
```

### messages — 對話訊息

```sql
CREATE TABLE messages (
  id              TEXT PRIMARY KEY,         -- 'msg_' + nanoid(12)
  conversation_id TEXT NOT NULL,
  role            TEXT NOT NULL,            -- 'user' | 'assistant'
  content         TEXT NOT NULL,            -- 訊息文字內容
  metadata        TEXT,                     -- JSON: context_files, tool_calls, tokens_used, etc.
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at ASC);
```

**metadata JSON 結構（assistant messages）**:
```json
{
  "contextFiles": ["src/index.ts"],
  "toolCalls": [
    {
      "tool": "file_write",
      "args": {"path": "src/middleware/rate-limiter.ts"},
      "result": "success"
    }
  ],
  "filesModified": ["src/middleware/rate-limiter.ts", "src/index.ts"],
  "tokensUsed": {
    "input": 2500,
    "output": 1200
  },
  "voiceInput": false
}
```

### tasks — 任務佇列 (Phase 2，但先建表)

```sql
CREATE TABLE tasks (
  id            TEXT PRIMARY KEY,           -- 'task_' + nanoid(12)
  workspace_id  TEXT NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL,              -- 自然語言任務描述
  status        TEXT NOT NULL DEFAULT 'queued',
                                            -- queued | running | awaiting_review
                                            -- | approved | committed | failed
  priority      INTEGER NOT NULL DEFAULT 0, -- 0 = normal, 1 = high, -1 = low
  branch_name   TEXT,                       -- 'vibe/task-{id}-{slug}'
  depends_on    TEXT,                       -- 依賴的 task id
  diff_summary  TEXT,                       -- JSON: files changed summary
  error_message TEXT,                       -- 失敗原因
  retry_count   INTEGER NOT NULL DEFAULT 0,
  context_files TEXT,                       -- JSON: string[]
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  started_at    TEXT,                       -- 開始執行時間
  completed_at  TEXT,                       -- 完成時間
  
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (depends_on) REFERENCES tasks(id) ON DELETE SET NULL
);

CREATE INDEX idx_tasks_workspace ON tasks(workspace_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_depends ON tasks(depends_on);
```

### task_messages — Task 的 AI 對話紀錄 (Phase 2)

```sql
CREATE TABLE task_messages (
  id            TEXT PRIMARY KEY,           -- 'tmsg_' + nanoid(12)
  task_id       TEXT NOT NULL,
  role          TEXT NOT NULL,              -- 'user' | 'assistant' | 'system'
  content       TEXT NOT NULL,
  metadata      TEXT,                       -- JSON
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE INDEX idx_task_messages_task ON task_messages(task_id, created_at ASC);
```

### prompt_templates — Prompt 範本

```sql
CREATE TABLE prompt_templates (
  id            TEXT PRIMARY KEY,           -- 'tpl_' + nanoid(12)
  workspace_id  TEXT,                       -- NULL = global template
  name          TEXT NOT NULL,
  template      TEXT NOT NULL,              -- 可包含 {placeholder} 變數
  category      TEXT,                       -- 'maintenance' | 'feature' | 'testing' | 'refactor' | 'custom'
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX idx_templates_workspace ON prompt_templates(workspace_id);
```

### devices — 已配對的裝置

```sql
CREATE TABLE devices (
  id            TEXT PRIMARY KEY,           -- 'dev_' + nanoid(12)
  device_name   TEXT NOT NULL,              -- 'iPhone 15 Pro'
  device_id     TEXT NOT NULL UNIQUE,       -- 裝置指紋
  refresh_token TEXT NOT NULL,
  last_seen_at  TEXT NOT NULL DEFAULT (datetime('now')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### diff_reviews — Diff review 狀態追蹤

```sql
CREATE TABLE diff_reviews (
  id            TEXT PRIMARY KEY,           -- 'dr_' + nanoid(12)
  workspace_id  TEXT NOT NULL,
  conversation_id TEXT,                     -- 觸發這次 diff 的對話
  task_id       TEXT,                       -- 或觸發這次 diff 的 task
  file_path     TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  comment       TEXT,                       -- reject 時的回饋
  diff_content  TEXT NOT NULL,              -- 該檔案的 diff 內容
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
);

CREATE INDEX idx_diff_reviews_workspace ON diff_reviews(workspace_id, status);
```

### push_subscriptions — PWA Push Notification 訂閱

```sql
CREATE TABLE push_subscriptions (
  id            TEXT PRIMARY KEY,           -- 'push_' + nanoid(12)
  device_id     TEXT NOT NULL,
  endpoint      TEXT NOT NULL UNIQUE,
  keys_p256dh   TEXT NOT NULL,
  keys_auth     TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);
```

## Migration 策略

使用簡單的版本號檔案管理 migration。

```
server/src/db/
├── sqlite.ts              # DB 連線 + 初始化
├── migrations/
│   ├── 001_initial.sql    # 建立所有 Phase 1 tables
│   ├── 002_tasks.sql      # Phase 2 task queue tables
│   └── ...
└── migrate.ts             # Migration runner
```

**Migration runner 邏輯**:

```sql
-- Migration 追蹤表
CREATE TABLE IF NOT EXISTS _migrations (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  filename  TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

啟動時：
1. 讀取 `migrations/` 目錄下所有 `.sql` 檔
2. 比對 `_migrations` 表，找出未執行的
3. 按檔名排序，依序執行
4. 每個 migration 在一個 transaction 中執行

## 常用查詢模式

### 取得 workspace 列表（含 active 標記）

```sql
SELECT id, name, path, git_remote, default_branch, is_active, created_at
FROM workspaces
ORDER BY is_active DESC, updated_at DESC;
```

### 取得對話列表（最新的在前）

```sql
SELECT c.id, c.workspace_id, c.title,
       COUNT(m.id) as message_count,
       c.created_at, c.updated_at
FROM conversations c
LEFT JOIN messages m ON m.conversation_id = c.id
WHERE c.workspace_id = ?
GROUP BY c.id
ORDER BY c.updated_at DESC
LIMIT ? OFFSET ?;
```

### 取得 task queue（按優先序 + 依賴順序）

```sql
SELECT t.*, 
       dt.status as dependency_status
FROM tasks t
LEFT JOIN tasks dt ON t.depends_on = dt.id
WHERE t.workspace_id = ?
ORDER BY 
  CASE t.status 
    WHEN 'running' THEN 0
    WHEN 'awaiting_review' THEN 1
    WHEN 'queued' THEN 2
    WHEN 'approved' THEN 3
    WHEN 'committed' THEN 4
    WHEN 'failed' THEN 5
  END,
  t.priority DESC,
  t.created_at ASC;
```

### 取得下一個可執行的 task

```sql
SELECT t.*
FROM tasks t
LEFT JOIN tasks dep ON t.depends_on = dep.id
WHERE t.status = 'queued'
  AND (t.depends_on IS NULL OR dep.status IN ('approved', 'committed'))
ORDER BY t.priority DESC, t.created_at ASC
LIMIT 1;
```

## 備份

SQLite 檔案可以直接 copy。建議：

```bash
# 安全備份（不會被 WAL 影響）
sqlite3 data/vibe-remote.db ".backup data/backup-$(date +%Y%m%d).db"
```

可以設定 cron job 每天備份。
