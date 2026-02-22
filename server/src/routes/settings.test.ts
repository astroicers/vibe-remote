import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import express from 'express';
import request from 'supertest';

let mockDb: Database.Database;

// Mock BEFORE imports
vi.mock('../db/index.js', () => ({
  getDb: () => mockDb,
}));

vi.mock('../auth/middleware.js', () => ({
  authMiddleware: (_req: any, _res: any, next: any) => {
    _req.device = { deviceId: 'dev_test', deviceName: 'Test Device' };
    next();
  },
}));

import settingsRoutes from './settings.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/settings', settingsRoutes);
  return app;
}

// Separate app with NO auth middleware mock for 401 tests
function createAppNoAuth() {
  const app = express();
  app.use(express.json());
  // Use a middleware that simulates missing auth
  app.use('/settings', (_req, res) => {
    res.status(401).json({ error: 'Missing or invalid authorization header', code: 'UNAUTHORIZED' });
  });
  return app;
}

describe('Settings Routes', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    mockDb = new Database(':memory:');
    mockDb.pragma('journal_mode = WAL');
    mockDb.pragma('foreign_keys = ON');

    mockDb.exec(`
      CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        public_key TEXT,
        last_seen_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS device_settings (
        device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (device_id, key)
      );

      CREATE INDEX IF NOT EXISTS idx_device_settings_device ON device_settings(device_id);
    `);

    // Insert the test device so FK constraints pass
    mockDb.prepare(
      "INSERT INTO devices (id, name, last_seen_at) VALUES (?, ?, datetime('now'))"
    ).run('dev_test', 'Test Device');

    app = createApp();
  });

  afterEach(() => {
    mockDb.close();
  });

  describe('GET /settings', () => {
    it('should return empty settings for new device', async () => {
      const res = await request(app).get('/settings');

      expect(res.status).toBe(200);
      expect(res.body.settings).toEqual({});
    });

    it('should return existing settings', async () => {
      mockDb.prepare(
        "INSERT INTO device_settings (device_id, key, value) VALUES (?, ?, ?)"
      ).run('dev_test', 'model', 'opus');
      mockDb.prepare(
        "INSERT INTO device_settings (device_id, key, value) VALUES (?, ?, ?)"
      ).run('dev_test', 'voiceEnabled', 'true');

      const res = await request(app).get('/settings');

      expect(res.status).toBe(200);
      expect(res.body.settings).toEqual({
        model: 'opus',
        voiceEnabled: 'true',
      });
    });
  });

  describe('PUT /settings', () => {
    it('should upsert settings and return all', async () => {
      const res = await request(app)
        .put('/settings')
        .send({ settings: { model: 'sonnet', voiceEnabled: 'true' } });

      expect(res.status).toBe(200);
      expect(res.body.settings).toEqual({
        model: 'sonnet',
        voiceEnabled: 'true',
      });

      // Verify in DB
      const rows = mockDb.prepare('SELECT key, value FROM device_settings WHERE device_id = ?').all('dev_test') as Array<{ key: string; value: string }>;
      expect(rows).toHaveLength(2);
    });

    it('should update existing settings', async () => {
      // Set initial
      mockDb.prepare(
        "INSERT INTO device_settings (device_id, key, value) VALUES (?, ?, ?)"
      ).run('dev_test', 'model', 'sonnet');

      // Update
      const res = await request(app)
        .put('/settings')
        .send({ settings: { model: 'opus' } });

      expect(res.status).toBe(200);
      expect(res.body.settings.model).toBe('opus');
    });

    it('should return 400 for invalid key format', async () => {
      const res = await request(app)
        .put('/settings')
        .send({ settings: { 'invalid key!': 'value' } });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for value too long', async () => {
      const longValue = 'x'.repeat(2001);
      const res = await request(app)
        .put('/settings')
        .send({ settings: { testKey: longValue } });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for too many settings', async () => {
      const tooMany: Record<string, string> = {};
      for (let i = 0; i < 51; i++) {
        tooMany[`key_${i}`] = 'value';
      }
      const res = await request(app)
        .put('/settings')
        .send({ settings: tooMany });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('PATCH /settings/:key', () => {
    it('should update a single setting', async () => {
      const res = await request(app)
        .patch('/settings/model')
        .send({ value: 'opus' });

      expect(res.status).toBe(200);
      expect(res.body.key).toBe('model');
      expect(res.body.value).toBe('opus');
      expect(res.body.updated_at).toBeDefined();

      // Verify in DB
      const row = mockDb.prepare('SELECT value FROM device_settings WHERE device_id = ? AND key = ?').get('dev_test', 'model') as { value: string };
      expect(row.value).toBe('opus');
    });

    it('should create a setting if it does not exist', async () => {
      const res = await request(app)
        .patch('/settings/newKey')
        .send({ value: 'newValue' });

      expect(res.status).toBe(200);
      expect(res.body.key).toBe('newKey');
      expect(res.body.value).toBe('newValue');
    });

    it('should return 400 for invalid key format', async () => {
      const res = await request(app)
        .patch('/settings/bad key!')
        .send({ value: 'test' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for invalid value', async () => {
      const res = await request(app)
        .patch('/settings/model')
        .send({ value: 'x'.repeat(2001) });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for missing value in body', async () => {
      const res = await request(app)
        .patch('/settings/model')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /settings/:key', () => {
    it('should delete an existing setting', async () => {
      mockDb.prepare(
        "INSERT INTO device_settings (device_id, key, value) VALUES (?, ?, ?)"
      ).run('dev_test', 'model', 'sonnet');

      const res = await request(app).delete('/settings/model');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify deleted
      const row = mockDb.prepare('SELECT * FROM device_settings WHERE device_id = ? AND key = ?').get('dev_test', 'model');
      expect(row).toBeUndefined();
    });

    it('should succeed even if key does not exist', async () => {
      const res = await request(app).delete('/settings/nonexistent');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 for invalid key format', async () => {
      const res = await request(app).delete('/settings/bad key!');

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Authentication', () => {
    it('should return 401 without auth token', async () => {
      const noAuthApp = createAppNoAuth();
      const res = await request(noAuthApp).get('/settings');

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });
  });
});
