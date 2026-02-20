import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import express from 'express';
import request from 'supertest';

let mockDb: Database.Database;

// Mock BEFORE imports
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

import templateRoutes from './templates.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/templates', templateRoutes);
  return app;
}

describe('Template Routes', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    mockDb = new Database(':memory:');
    mockDb.pragma('journal_mode = WAL');
    mockDb.pragma('foreign_keys = ON');

    mockDb.exec(`
      CREATE TABLE IF NOT EXISTS prompt_templates (
        id TEXT PRIMARY KEY,
        workspace_id TEXT,
        name TEXT NOT NULL,
        content TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);

    app = createApp();
  });

  afterEach(() => {
    mockDb.close();
  });

  describe('GET /templates', () => {
    it('should return 400 without workspaceId', async () => {
      const res = await request(app).get('/templates');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('workspaceId is required');
      expect(res.body.code).toBe('MISSING_WORKSPACE_ID');
    });

    it('should return templates (global + workspace-specific)', async () => {
      // Insert a global template (workspace_id IS NULL)
      mockDb.prepare(
        "INSERT INTO prompt_templates (id, workspace_id, name, content, sort_order) VALUES (?, NULL, ?, ?, ?)"
      ).run('tpl_global', 'Global Template', 'Global content', 1);

      // Insert a workspace-specific template
      mockDb.prepare(
        "INSERT INTO prompt_templates (id, workspace_id, name, content, sort_order) VALUES (?, ?, ?, ?, ?)"
      ).run('tpl_ws1', 'ws_test', 'WS Template', 'WS content', 2);

      // Insert a template for a different workspace (should NOT be returned)
      mockDb.prepare(
        "INSERT INTO prompt_templates (id, workspace_id, name, content, sort_order) VALUES (?, ?, ?, ?, ?)"
      ).run('tpl_other', 'ws_other', 'Other Template', 'Other content', 1);

      const res = await request(app).get('/templates?workspaceId=ws_test');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      // Global template first (sort_order 1), then workspace template (sort_order 2)
      expect(res.body[0].id).toBe('tpl_global');
      expect(res.body[1].id).toBe('tpl_ws1');
    });
  });

  describe('POST /templates', () => {
    it('should create a template and return 201', async () => {
      const res = await request(app)
        .post('/templates')
        .send({ workspaceId: 'ws_test', name: 'My Template', content: 'Template body' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('My Template');
      expect(res.body.content).toBe('Template body');
      expect(res.body.workspace_id).toBe('ws_test');
      expect(res.body.id).toMatch(/^tpl_/);
      expect(res.body.sort_order).toBe(1);
    });

    it('should return 400 when name is missing', async () => {
      const res = await request(app)
        .post('/templates')
        .send({ content: 'Template body' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when content is missing', async () => {
      const res = await request(app)
        .post('/templates')
        .send({ name: 'My Template' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should auto-increment sort_order for subsequent templates', async () => {
      // Create first template
      const res1 = await request(app)
        .post('/templates')
        .send({ workspaceId: 'ws_test', name: 'First', content: 'First content' });

      expect(res1.status).toBe(201);
      expect(res1.body.sort_order).toBe(1);

      // Create second template
      const res2 = await request(app)
        .post('/templates')
        .send({ workspaceId: 'ws_test', name: 'Second', content: 'Second content' });

      expect(res2.status).toBe(201);
      expect(res2.body.sort_order).toBe(2);

      // Create third template
      const res3 = await request(app)
        .post('/templates')
        .send({ workspaceId: 'ws_test', name: 'Third', content: 'Third content' });

      expect(res3.status).toBe(201);
      expect(res3.body.sort_order).toBe(3);
    });
  });

  describe('PATCH /templates/:id', () => {
    it('should update the name of a template', async () => {
      mockDb.prepare(
        "INSERT INTO prompt_templates (id, workspace_id, name, content, sort_order) VALUES (?, ?, ?, ?, ?)"
      ).run('tpl_1', 'ws_test', 'Old Name', 'Content', 1);

      const res = await request(app)
        .patch('/templates/tpl_1')
        .send({ name: 'New Name' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('New Name');
      expect(res.body.content).toBe('Content');
    });

    it('should update the content of a template', async () => {
      mockDb.prepare(
        "INSERT INTO prompt_templates (id, workspace_id, name, content, sort_order) VALUES (?, ?, ?, ?, ?)"
      ).run('tpl_1', 'ws_test', 'Name', 'Old Content', 1);

      const res = await request(app)
        .patch('/templates/tpl_1')
        .send({ content: 'New Content' });

      expect(res.status).toBe(200);
      expect(res.body.content).toBe('New Content');
      expect(res.body.name).toBe('Name');
    });

    it('should return 404 for non-existent template', async () => {
      const res = await request(app)
        .patch('/templates/tpl_nonexistent')
        .send({ name: 'Updated' });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
      expect(res.body.error).toBe('Template not found');
    });

    it('should return 400 when body is empty (no name or content)', async () => {
      mockDb.prepare(
        "INSERT INTO prompt_templates (id, workspace_id, name, content, sort_order) VALUES (?, ?, ?, ?, ?)"
      ).run('tpl_1', 'ws_test', 'Name', 'Content', 1);

      const res = await request(app)
        .patch('/templates/tpl_1')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.error).toBe('At least one of name or content must be provided');
    });
  });

  describe('DELETE /templates/:id', () => {
    it('should delete a template successfully', async () => {
      mockDb.prepare(
        "INSERT INTO prompt_templates (id, workspace_id, name, content, sort_order) VALUES (?, ?, ?, ?, ?)"
      ).run('tpl_1', 'ws_test', 'Name', 'Content', 1);

      const res = await request(app).delete('/templates/tpl_1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify it was actually deleted from DB
      const row = mockDb.prepare('SELECT * FROM prompt_templates WHERE id = ?').get('tpl_1');
      expect(row).toBeUndefined();
    });

    it('should return 404 for non-existent template', async () => {
      const res = await request(app).delete('/templates/tpl_nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
      expect(res.body.error).toBe('Template not found');
    });
  });
});
