import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { config } from '../config.js';
import { SCHEMA, SEED_DATA } from './schema.js';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}

export function initDb(): Database.Database {
  if (db) {
    return db;
  }

  // Ensure directory exists
  const dbDir = dirname(config.DATABASE_PATH);
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  // Open database
  db = new Database(config.DATABASE_PATH);

  // Enable WAL mode for better concurrent read/write
  db.pragma('journal_mode = WAL');

  // Set busy timeout to avoid SQLITE_BUSY on concurrent access
  db.pragma('busy_timeout = 5000');

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Run schema
  db.exec(SCHEMA);

  // Run migrations for existing databases
  runMigrations(db);

  // Run seed data (uses INSERT OR IGNORE)
  db.exec(SEED_DATA);

  console.log('✅ Database initialized:', config.DATABASE_PATH);

  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
    console.log('📦 Database closed');
  }
}

// Helper to generate IDs
export function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}${random}`;
}

// Run migrations for existing databases
function runMigrations(database: Database.Database): void {
  // Migration 1: Add sdk_session_id to conversations
  const hasSessionIdColumn = database
    .prepare("SELECT COUNT(*) as count FROM pragma_table_info('conversations') WHERE name = 'sdk_session_id'")
    .get() as { count: number };

  if (hasSessionIdColumn.count === 0) {
    database.exec('ALTER TABLE conversations ADD COLUMN sdk_session_id TEXT');
    console.log('✅ Migration: Added sdk_session_id column to conversations');
  }

  // Migration 2: Update tasks table to support new statuses and fields
  // Add result and error columns if missing
  const hasResultColumn = database
    .prepare("SELECT COUNT(*) as count FROM pragma_table_info('tasks') WHERE name = 'result'")
    .get() as { count: number };

  if (hasResultColumn.count === 0) {
    database.exec('ALTER TABLE tasks ADD COLUMN result TEXT');
    database.exec('ALTER TABLE tasks ADD COLUMN error TEXT');
    console.log('✅ Migration: Added result and error columns to tasks');
  }

  // Add updated_at column if missing
  const hasUpdatedAt = database
    .prepare("SELECT COUNT(*) as count FROM pragma_table_info('tasks') WHERE name = 'updated_at'")
    .get() as { count: number };

  if (hasUpdatedAt.count === 0) {
    database.exec("ALTER TABLE tasks ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'))");
    console.log('✅ Migration: Added updated_at column to tasks');
  }

  // Recreate tasks table with extended status CHECK constraint
  // SQLite doesn't support ALTER TABLE to modify CHECK constraints, so we
  // detect whether migration is needed by checking the table's SQL definition.
  const tableInfo = database
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='tasks'")
    .get() as { sql: string } | undefined;

  const needsRecreate = tableInfo?.sql && !tableInfo.sql.includes("'pending'");

  if (needsRecreate) {
    console.log('✅ Migration: Recreating tasks table with extended status values');
    database.exec(`
      CREATE TABLE IF NOT EXISTS tasks_new (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'queued', 'running', 'awaiting_review', 'approved', 'committed', 'completed', 'failed', 'cancelled')),
        priority TEXT NOT NULL DEFAULT 'normal'
          CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
        progress INTEGER,
        branch TEXT,
        depends_on TEXT,
        context_files TEXT,
        result TEXT,
        error TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        started_at TEXT,
        completed_at TEXT,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT OR IGNORE INTO tasks_new (id, workspace_id, title, description, status, priority, progress, branch, depends_on, context_files, created_at, started_at, completed_at)
        SELECT id, workspace_id, title, description, status, priority, progress, branch, depends_on, context_files, created_at, started_at, completed_at FROM tasks;
      DROP TABLE tasks;
      ALTER TABLE tasks_new RENAME TO tasks;
      CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON tasks(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    `);
  }
}
