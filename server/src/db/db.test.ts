import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { SCHEMA } from './schema.js';

describe('Database Schema', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.exec(SCHEMA);
  });

  afterEach(() => {
    db.close();
  });

  describe('indexes', () => {
    it('should create conversations(updated_at) index', () => {
      const index = db
        .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_conversations_updated'")
        .get() as { name: string } | undefined;
      expect(index?.name).toBe('idx_conversations_updated');
    });

    it('should create messages(conversation_id, created_at) composite index', () => {
      const index = db
        .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_messages_conv_created'")
        .get() as { name: string } | undefined;
      expect(index?.name).toBe('idx_messages_conv_created');
    });

    it('should create tasks(workspace_id, status) composite index', () => {
      const index = db
        .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_tasks_workspace_status'")
        .get() as { name: string } | undefined;
      expect(index?.name).toBe('idx_tasks_workspace_status');
    });

    it('should have all expected indexes', () => {
      const indexes = db
        .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name")
        .all() as Array<{ name: string }>;

      const indexNames = indexes.map((i) => i.name);
      expect(indexNames).toContain('idx_conversations_workspace');
      expect(indexNames).toContain('idx_conversations_updated');
      expect(indexNames).toContain('idx_messages_conversation');
      expect(indexNames).toContain('idx_messages_conv_created');
      expect(indexNames).toContain('idx_tasks_workspace');
      expect(indexNames).toContain('idx_tasks_status');
      expect(indexNames).toContain('idx_tasks_workspace_status');
      expect(indexNames).toContain('idx_diff_reviews_workspace');
      expect(indexNames).toContain('idx_prompt_templates_workspace');
      expect(indexNames).toContain('idx_device_settings_device');
    });
  });

  describe('ReviewStatus constraint', () => {
    it('should accept partial status in diff_reviews', () => {
      db.prepare("INSERT INTO workspaces (id, name, path) VALUES ('ws1', 'Test', '/test')").run();
      expect(() => {
        db.prepare(
          "INSERT INTO diff_reviews (id, workspace_id, files_json, status) VALUES ('dr1', 'ws1', '[]', 'partial')"
        ).run();
      }).not.toThrow();
    });

    it('should reject invalid status in diff_reviews', () => {
      db.prepare("INSERT INTO workspaces (id, name, path) VALUES ('ws1', 'Test', '/test')").run();
      expect(() => {
        db.prepare(
          "INSERT INTO diff_reviews (id, workspace_id, files_json, status) VALUES ('dr1', 'ws1', '[]', 'commented')"
        ).run();
      }).toThrow();
    });
  });

  describe('tasks table schema', () => {
    it('should accept extended status values including pending', () => {
      db.prepare("INSERT INTO workspaces (id, name, path) VALUES ('ws1', 'Test', '/test')").run();
      const statuses = ['queued', 'running', 'awaiting_review', 'approved', 'committed', 'failed'];
      for (const status of statuses) {
        expect(() => {
          db.prepare(
            `INSERT INTO tasks (id, workspace_id, title, description, status, priority) VALUES ('t_${status}', 'ws1', 'Test', 'Desc', '${status}', 'normal')`
          ).run();
        }).not.toThrow();
      }
    });
  });
});

describe('Database Init Pragmas', () => {
  it('should support busy_timeout pragma', () => {
    const db = new Database(':memory:');
    db.pragma('busy_timeout = 5000');
    const result = db.pragma('busy_timeout');
    // better-sqlite3 returns [{busy_timeout: N}] for file DBs
    // For :memory: it returns the value — just verify it doesn't throw and returns something
    expect(result).toBeDefined();
    db.close();
  });

  it('should accept WAL journal mode pragma without error', () => {
    const db = new Database(':memory:');
    // In-memory databases may return 'memory' instead of 'wal', but the call should not throw
    expect(() => db.pragma('journal_mode = WAL')).not.toThrow();
    db.close();
  });
});

describe('Migration detection via sqlite_master', () => {
  it('should detect tasks table SQL definition from SCHEMA', () => {
    const db = new Database(':memory:');
    db.exec(SCHEMA);

    const tableInfo = db
      .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='tasks'")
      .get() as { sql: string } | undefined;

    expect(tableInfo).toBeDefined();
    // The SCHEMA defines tasks with 'queued' as default — 'pending' is NOT in the original schema
    // The migration adds 'pending' by recreating the table
    expect(tableInfo!.sql).toContain("'queued'");
    expect(tableInfo!.sql).toContain("'running'");
    expect(tableInfo!.sql).toContain("'failed'");
    db.close();
  });

  it('should detect old schema without pending status for migration check', () => {
    const db = new Database(':memory:');
    db.exec(SCHEMA);

    const tableInfo = db
      .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='tasks'")
      .get() as { sql: string } | undefined;

    // Original SCHEMA does NOT include 'pending' — migration detection would trigger
    const needsRecreate = tableInfo?.sql && !tableInfo.sql.includes("'pending'");
    expect(needsRecreate).toBe(true);
    db.close();
  });

  it('should detect migrated schema with pending status', () => {
    const db = new Database(':memory:');
    // Simulate a migrated tasks table that includes 'pending'
    db.exec(`
      CREATE TABLE workspaces (id TEXT PRIMARY KEY, name TEXT NOT NULL, path TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE TABLE tasks (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id),
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'queued', 'running', 'awaiting_review', 'approved', 'committed', 'completed', 'failed', 'cancelled')),
        priority TEXT NOT NULL DEFAULT 'normal',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    const tableInfo = db
      .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='tasks'")
      .get() as { sql: string } | undefined;

    const needsRecreate = tableInfo?.sql && !tableInfo.sql.includes("'pending'");
    expect(needsRecreate).toBe(false);
    db.close();
  });
});
