import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import express from 'express';
import request from 'supertest';

let mockDb: Database.Database;

// Mock BEFORE imports — tasks.ts instantiates TaskManager + TaskQueue at module level,
// which call getDb() internally, so the mock must be in place before import.
vi.mock('../db/index.js', () => ({
  getDb: () => mockDb,
  generateId: vi.fn((prefix: string) => `${prefix}_test_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`),
}));

vi.mock('../auth/middleware.js', () => ({
  authMiddleware: (_req: any, _res: any, next: any) => {
    _req.device = { deviceId: 'dev_test', deviceName: 'Test Device' };
    next();
  },
}));

vi.mock('../ws/index.js', () => ({
  broadcastTaskStatus: vi.fn(),
}));

import taskRoutes from './tasks.js';
import { broadcastTaskStatus } from '../ws/index.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/tasks', taskRoutes);
  return app;
}

function seedWorkspace() {
  mockDb.prepare(
    "INSERT INTO workspaces (id, name, path) VALUES (?, ?, ?)"
  ).run('ws_test', 'Test Project', '/test/path');
}

function createTask(overrides: Record<string, unknown> = {}) {
  const id = overrides.id as string || `task_seed_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const defaults = {
    id,
    workspace_id: 'ws_test',
    title: 'Test Task',
    description: 'A test task description',
    status: 'pending',
    priority: 'normal',
  };
  const data = { ...defaults, ...overrides };
  mockDb.prepare(`
    INSERT INTO tasks (id, workspace_id, title, description, status, priority)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(data.id, data.workspace_id, data.title, data.description, data.status, data.priority);
  return data;
}

describe('Task Routes', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    mockDb = new Database(':memory:');
    mockDb.pragma('journal_mode = WAL');
    mockDb.pragma('foreign_keys = ON');

    mockDb.exec(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        is_active INTEGER DEFAULT 0,
        system_prompt TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','queued','running','awaiting_review','approved','committed','completed','failed','cancelled')),
        priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high','urgent')),
        progress REAL,
        branch TEXT,
        depends_on TEXT,
        context_files TEXT,
        result TEXT,
        error TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        started_at TEXT,
        completed_at TEXT,
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
      );
    `);

    seedWorkspace();
    app = createApp();
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockDb.close();
  });

  describe('GET /tasks', () => {
    it('should return 400 without workspaceId', async () => {
      const res = await request(app).get('/tasks');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('workspaceId is required');
      expect(res.body.code).toBe('MISSING_WORKSPACE_ID');
    });

    it('should return tasks for workspace', async () => {
      createTask({ id: 'task_1', title: 'Task One' });
      createTask({ id: 'task_2', title: 'Task Two' });

      const res = await request(app).get('/tasks?workspaceId=ws_test');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      // Tasks are ordered by priority then by created_at DESC
      const titles = res.body.map((t: any) => t.title);
      expect(titles).toContain('Task One');
      expect(titles).toContain('Task Two');
    });
  });

  describe('GET /tasks/:id', () => {
    it('should return a single task', async () => {
      createTask({ id: 'task_single', title: 'Single Task', description: 'My description' });

      const res = await request(app).get('/tasks/task_single');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('task_single');
      expect(res.body.title).toBe('Single Task');
      expect(res.body.description).toBe('My description');
    });

    it('should return 404 for non-existent task', async () => {
      const res = await request(app).get('/tasks/task_nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
      expect(res.body.error).toBe('Task not found');
    });
  });

  describe('POST /tasks', () => {
    it('should create a task and return 201', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({
          workspaceId: 'ws_test',
          title: 'New Task',
          description: 'New task description',
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toMatch(/^task_/);
      expect(res.body.title).toBe('New Task');
      expect(res.body.description).toBe('New task description');
      expect(res.body.status).toBe('pending');
      expect(res.body.priority).toBe('normal');
    });

    it('should return 400 for invalid body (missing required fields)', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({ title: 'Missing workspace and description' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.details).toBeDefined();
    });

    it('should create a task with contextFiles', async () => {
      const res = await request(app)
        .post('/tasks')
        .send({
          workspaceId: 'ws_test',
          title: 'Task With Context',
          description: 'A task with context files',
          contextFiles: ['src/app.ts', 'src/index.ts'],
        });

      expect(res.status).toBe(201);
      expect(res.body.context_files).toBe(JSON.stringify(['src/app.ts', 'src/index.ts']));
    });
  });

  describe('PATCH /tasks/:id', () => {
    it('should update a task', async () => {
      createTask({ id: 'task_upd', title: 'Original Title', description: 'Original desc' });

      const res = await request(app)
        .patch('/tasks/task_upd')
        .send({ title: 'Updated Title' });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Updated Title');
    });

    it('should return 404 for non-existent task', async () => {
      const res = await request(app)
        .patch('/tasks/task_nonexistent')
        .send({ title: 'Updated' });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });

    it('should return 400 when body is empty', async () => {
      createTask({ id: 'task_empty', title: 'Some Task' });

      const res = await request(app)
        .patch('/tasks/task_empty')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.error).toBe('At least one field must be provided');
    });

    it('should call broadcastTaskStatus when status is changed', async () => {
      createTask({ id: 'task_status', title: 'Status Task' });

      const res = await request(app)
        .patch('/tasks/task_status')
        .send({ status: 'completed' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('completed');
      expect(broadcastTaskStatus).toHaveBeenCalled();
    });
  });

  describe('DELETE /tasks/:id', () => {
    it('should delete a task successfully', async () => {
      createTask({ id: 'task_del', title: 'Delete Me' });

      const res = await request(app).delete('/tasks/task_del');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify it was deleted from DB
      const row = mockDb.prepare('SELECT * FROM tasks WHERE id = ?').get('task_del');
      expect(row).toBeUndefined();
    });

    it('should return 404 for non-existent task', async () => {
      const res = await request(app).delete('/tasks/task_nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });

    it('should return 400 when trying to delete a running task', async () => {
      createTask({ id: 'task_running', title: 'Running Task', status: 'running' });

      const res = await request(app).delete('/tasks/task_running');

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('TASK_RUNNING');
      expect(res.body.error).toBe('Cannot delete a running task. Cancel it first.');
    });
  });

  describe('POST /tasks/:id/run', () => {
    it('should enqueue a pending task', async () => {
      createTask({ id: 'task_run', title: 'Run Me' });

      const res = await request(app).post('/tasks/task_run/run');

      expect(res.status).toBe(200);
      // The route returns the task (still in its current state at the time of response)
      expect(res.body.id).toBe('task_run');
    });

    it('should return 400 for non-pending task', async () => {
      createTask({ id: 'task_completed', title: 'Done', status: 'completed' });

      const res = await request(app).post('/tasks/task_completed/run');

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_STATUS');
      expect(res.body.error).toContain('Cannot run task with status');
    });

    it('should return 404 for non-existent task', async () => {
      const res = await request(app).post('/tasks/task_nonexistent/run');

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /tasks/:id/cancel', () => {
    it('should cancel a pending task', async () => {
      createTask({ id: 'task_cancel', title: 'Cancel Me' });

      const res = await request(app).post('/tasks/task_cancel/cancel');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('cancelled');
    });

    it('should return 404 for non-existent task', async () => {
      const res = await request(app).post('/tasks/task_nonexistent/cancel');

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });

    it('should return 400 for a completed task', async () => {
      createTask({ id: 'task_done', title: 'Already Done', status: 'completed' });

      const res = await request(app).post('/tasks/task_done/cancel');

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_STATUS');
      expect(res.body.error).toContain('Cannot cancel task with status');
    });
  });
});
