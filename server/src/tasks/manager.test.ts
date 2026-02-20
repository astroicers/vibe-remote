import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { TaskManager } from './manager.js';

// Mock the db module
let mockDb: Database.Database;

vi.mock('../db/index.js', () => ({
  getDb: () => mockDb,
  generateId: vi.fn((prefix: string) => `${prefix}_test_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`),
}));

describe('TaskManager', () => {
  let manager: TaskManager;

  beforeEach(() => {
    // Create in-memory database
    mockDb = new Database(':memory:');
    mockDb.pragma('journal_mode = WAL');
    mockDb.pragma('foreign_keys = ON');

    // Create tables
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
      INSERT INTO workspaces (id, name, path) VALUES ('ws_2', 'Other Project', '/home/user/other-project');
    `);

    manager = new TaskManager();
  });

  afterEach(() => {
    mockDb.close();
  });

  describe('createTask', () => {
    it('should create a task with default values', () => {
      const task = manager.createTask({
        workspaceId: 'ws_1',
        title: 'Fix the bug',
        description: 'There is a bug in the login form',
      });

      expect(task).toBeDefined();
      expect(task.id).toMatch(/^task_/);
      expect(task.title).toBe('Fix the bug');
      expect(task.description).toBe('There is a bug in the login form');
      expect(task.status).toBe('pending');
      expect(task.priority).toBe('normal');
      expect(task.workspace_id).toBe('ws_1');
      expect(task.context_files).toBeNull();
    });

    it('should create a task with custom priority and context files', () => {
      const task = manager.createTask({
        workspaceId: 'ws_1',
        title: 'Urgent fix',
        description: 'Critical production bug',
        priority: 'urgent',
        contextFiles: ['src/auth.ts', 'src/login.tsx'],
      });

      expect(task.priority).toBe('urgent');
      expect(task.context_files).toBe(JSON.stringify(['src/auth.ts', 'src/login.tsx']));
    });
  });

  describe('getTask', () => {
    it('should return a task by id', () => {
      const created = manager.createTask({
        workspaceId: 'ws_1',
        title: 'Test task',
        description: 'A test',
      });

      const found = manager.getTask(created.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
      expect(found!.title).toBe('Test task');
    });

    it('should return null for non-existent task', () => {
      const found = manager.getTask('task_nonexistent');
      expect(found).toBeNull();
    });
  });

  describe('listTasks', () => {
    it('should list tasks for a workspace', () => {
      manager.createTask({ workspaceId: 'ws_1', title: 'Task 1', description: 'Desc 1' });
      manager.createTask({ workspaceId: 'ws_1', title: 'Task 2', description: 'Desc 2' });
      manager.createTask({ workspaceId: 'ws_2', title: 'Task 3', description: 'Desc 3' });

      const ws1Tasks = manager.listTasks('ws_1');
      expect(ws1Tasks).toHaveLength(2);

      const ws2Tasks = manager.listTasks('ws_2');
      expect(ws2Tasks).toHaveLength(1);
      expect(ws2Tasks[0].title).toBe('Task 3');
    });

    it('should return empty array for workspace with no tasks', () => {
      const tasks = manager.listTasks('ws_1');
      expect(tasks).toHaveLength(0);
    });

    it('should order by priority then created_at', () => {
      manager.createTask({ workspaceId: 'ws_1', title: 'Low', description: 'Low', priority: 'low' });
      manager.createTask({ workspaceId: 'ws_1', title: 'Urgent', description: 'Urgent', priority: 'urgent' });
      manager.createTask({ workspaceId: 'ws_1', title: 'Normal', description: 'Normal', priority: 'normal' });

      const tasks = manager.listTasks('ws_1');
      expect(tasks[0].priority).toBe('urgent');
      expect(tasks[tasks.length - 1].priority).toBe('low');
    });
  });

  describe('updateTask', () => {
    it('should update task fields', () => {
      const task = manager.createTask({
        workspaceId: 'ws_1',
        title: 'Original',
        description: 'Original desc',
      });

      const updated = manager.updateTask(task.id, {
        title: 'Updated',
        description: 'Updated desc',
        priority: 'high',
      });

      expect(updated).toBeDefined();
      expect(updated!.title).toBe('Updated');
      expect(updated!.description).toBe('Updated desc');
      expect(updated!.priority).toBe('high');
    });

    it('should set started_at when status changes to running', () => {
      const task = manager.createTask({
        workspaceId: 'ws_1',
        title: 'Task',
        description: 'Desc',
      });

      expect(task.started_at).toBeNull();

      const running = manager.updateTask(task.id, { status: 'running' });
      expect(running!.started_at).not.toBeNull();
    });

    it('should set completed_at when status changes to completed', () => {
      const task = manager.createTask({
        workspaceId: 'ws_1',
        title: 'Task',
        description: 'Desc',
      });

      const completed = manager.updateTask(task.id, { status: 'completed', result: 'Done!' });
      expect(completed!.completed_at).not.toBeNull();
      expect(completed!.result).toBe('Done!');
    });

    it('should set completed_at when status changes to failed', () => {
      const task = manager.createTask({
        workspaceId: 'ws_1',
        title: 'Task',
        description: 'Desc',
      });

      const failed = manager.updateTask(task.id, { status: 'failed', error: 'Something broke' });
      expect(failed!.completed_at).not.toBeNull();
      expect(failed!.error).toBe('Something broke');
    });

    it('should return null for non-existent task', () => {
      const updated = manager.updateTask('task_nonexistent', { title: 'New' });
      expect(updated).toBeNull();
    });

    it('should return existing task if no updates provided', () => {
      const task = manager.createTask({
        workspaceId: 'ws_1',
        title: 'Task',
        description: 'Desc',
      });

      const same = manager.updateTask(task.id, {});
      expect(same!.id).toBe(task.id);
    });
  });

  describe('deleteTask', () => {
    it('should delete a task', () => {
      const task = manager.createTask({
        workspaceId: 'ws_1',
        title: 'Task',
        description: 'Desc',
      });

      const deleted = manager.deleteTask(task.id);
      expect(deleted).toBe(true);

      const found = manager.getTask(task.id);
      expect(found).toBeNull();
    });

    it('should return false for non-existent task', () => {
      const deleted = manager.deleteTask('task_nonexistent');
      expect(deleted).toBe(false);
    });
  });
});
