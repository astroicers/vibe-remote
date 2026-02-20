import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { TaskManager } from './manager.js';
import { TaskQueue } from './queue.js';

// Mock the db module
let mockDb: Database.Database;

vi.mock('../db/index.js', () => ({
  getDb: () => mockDb,
  generateId: vi.fn((prefix: string) => `${prefix}_test_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`),
}));

describe('TaskQueue', () => {
  let manager: TaskManager;
  let queue: TaskQueue;

  beforeEach(() => {
    // Create in-memory database
    mockDb = new Database(':memory:');
    mockDb.pragma('journal_mode = WAL');
    mockDb.pragma('foreign_keys = ON');

    mockDb.exec(`
      CREATE TABLE workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        is_active INTEGER NOT NULL DEFAULT 0,
        system_prompt TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE tasks (
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

      INSERT INTO workspaces (id, name, path) VALUES ('ws_1', 'Test Project', '/home/user/test-project');
    `);

    manager = new TaskManager();
    queue = new TaskQueue(manager);
  });

  afterEach(() => {
    mockDb.close();
  });

  describe('enqueue and processing', () => {
    it('should process a pending task', async () => {
      const statusChanges: string[] = [];
      const runner = vi.fn(async () => ({ result: 'Done!' }));

      queue.setRunner(runner);
      queue.onTaskStatusChange((task) => {
        statusChanges.push(task.status);
      });

      const task = manager.createTask({
        workspaceId: 'ws_1',
        title: 'Test task',
        description: 'Test description',
      });

      await queue.enqueue(task.id);

      // Wait for async processing
      await vi.waitFor(() => {
        expect(runner).toHaveBeenCalledTimes(1);
      });

      // Check status progression
      expect(statusChanges).toContain('running');
      expect(statusChanges).toContain('completed');

      // Verify in DB
      const updated = manager.getTask(task.id);
      expect(updated!.status).toBe('completed');
      expect(updated!.result).toBe('Done!');
    });

    it('should mark task as failed when runner returns error', async () => {
      const runner = vi.fn(async () => ({ error: 'Something went wrong' }));

      queue.setRunner(runner);

      const task = manager.createTask({
        workspaceId: 'ws_1',
        title: 'Failing task',
        description: 'Will fail',
      });

      await queue.enqueue(task.id);

      await vi.waitFor(() => {
        expect(runner).toHaveBeenCalledTimes(1);
      });

      const updated = manager.getTask(task.id);
      expect(updated!.status).toBe('failed');
      expect(updated!.error).toBe('Something went wrong');
    });

    it('should mark task as failed when runner throws', async () => {
      const runner = vi.fn(async () => {
        throw new Error('Runner crashed');
      });

      queue.setRunner(runner);

      const task = manager.createTask({
        workspaceId: 'ws_1',
        title: 'Crashing task',
        description: 'Will throw',
      });

      await queue.enqueue(task.id);

      await vi.waitFor(() => {
        expect(runner).toHaveBeenCalledTimes(1);
      });

      const updated = manager.getTask(task.id);
      expect(updated!.status).toBe('failed');
      expect(updated!.error).toBe('Runner crashed');
    });
  });

  describe('cancellation', () => {
    it('should cancel a pending task', async () => {
      queue.setRunner(async () => ({ result: 'Done' }));

      const task = manager.createTask({
        workspaceId: 'ws_1',
        title: 'Pending task',
        description: 'Will be cancelled',
      });

      const cancelled = await queue.cancel(task.id);

      expect(cancelled).toBeDefined();
      expect(cancelled!.status).toBe('cancelled');

      const updated = manager.getTask(task.id);
      expect(updated!.status).toBe('cancelled');
    });

    it('should return null for non-existent task', async () => {
      const result = await queue.cancel('task_nonexistent');
      expect(result).toBeNull();
    });

    it('should return task unchanged for already completed task', async () => {
      queue.setRunner(async () => ({ result: 'Done' }));

      const task = manager.createTask({
        workspaceId: 'ws_1',
        title: 'Completed task',
        description: 'Already done',
      });

      // Complete the task
      manager.updateTask(task.id, { status: 'completed' });

      const result = await queue.cancel(task.id);
      expect(result).toBeDefined();
      expect(result!.status).toBe('completed');
    });
  });
});
