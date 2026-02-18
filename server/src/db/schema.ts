// SQLite Schema for Vibe Remote
// Using better-sqlite3 (synchronous API)

export const SCHEMA = `
-- Devices (paired mobile devices)
CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  public_key TEXT,
  last_seen_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Workspaces (registered project directories)
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 0,
  system_prompt TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Conversations
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT,
  token_usage TEXT, -- JSON: { input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, cost_usd }
  sdk_session_id TEXT, -- Claude Agent SDK session ID for resume
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  tool_calls TEXT, -- JSON array of tool calls
  tool_results TEXT, -- JSON array of tool results
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tasks (Phase 2, but create table now)
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'awaiting_review', 'approved', 'committed', 'failed')),
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  progress INTEGER,
  branch TEXT,
  depends_on TEXT, -- JSON array of task IDs
  context_files TEXT, -- JSON array of file paths
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT
);

-- Diff reviews
CREATE TABLE IF NOT EXISTS diff_reviews (
  id TEXT PRIMARY KEY,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  files_json TEXT NOT NULL, -- JSON array of FileDiff objects
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'partial')),
  commit_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Diff comments
CREATE TABLE IF NOT EXISTS diff_comments (
  id TEXT PRIMARY KEY,
  diff_review_id TEXT NOT NULL REFERENCES diff_reviews(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  line_number INTEGER,
  content TEXT NOT NULL,
  author TEXT NOT NULL CHECK (author IN ('user', 'ai')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Push notification subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  keys TEXT NOT NULL, -- JSON with p256dh and auth
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Prompt templates
CREATE TABLE IF NOT EXISTS prompt_templates (
  id TEXT PRIMARY KEY,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE, -- NULL = global
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_conversations_workspace ON conversations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_diff_reviews_workspace ON diff_reviews(workspace_id);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_workspace ON prompt_templates(workspace_id);
`;

export const SEED_DATA = `
-- Insert default prompt templates
INSERT OR IGNORE INTO prompt_templates (id, workspace_id, name, content, sort_order) VALUES
  ('tpl_fix_lint', NULL, 'Fix lint', 'Fix all linting errors in the codebase', 1),
  ('tpl_write_tests', NULL, 'Write tests', 'Write unit tests for the recent changes', 2),
  ('tpl_refactor', NULL, 'Refactor', 'Refactor this code to improve readability and maintainability', 3),
  ('tpl_explain', NULL, 'Explain', 'Explain how this code works', 4),
  ('tpl_review', NULL, 'Review', 'Review this code and suggest improvements', 5);
`;
