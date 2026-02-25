import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock config for models module
vi.mock('../config.js', () => ({
  config: {
    CLAUDE_MODEL: 'claude-sonnet-4-20250514',
  },
}));

import modelRoutes from './models.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/models', modelRoutes);
  return app;
}

describe('Model Routes', () => {
  describe('GET /models', () => {
    it('returns 200 with models array and default key', async () => {
      const app = createApp();
      const res = await request(app).get('/models');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('models');
      expect(res.body).toHaveProperty('default');
      expect(Array.isArray(res.body.models)).toBe(true);
      expect(res.body.models.length).toBeGreaterThanOrEqual(3);
      expect(res.body.default).toBe('sonnet');
    });

    it('each model has key, name, description, and modelId', async () => {
      const app = createApp();
      const res = await request(app).get('/models');

      for (const model of res.body.models) {
        expect(model).toHaveProperty('key');
        expect(model).toHaveProperty('name');
        expect(model).toHaveProperty('description');
        expect(model).toHaveProperty('modelId');
        expect(typeof model.key).toBe('string');
        expect(typeof model.name).toBe('string');
        expect(typeof model.description).toBe('string');
        expect(typeof model.modelId).toBe('string');
      }
    });

    it('does not require authentication', async () => {
      const app = createApp();
      // No auth header
      const res = await request(app).get('/models');
      expect(res.status).toBe(200);
    });

    it('includes haiku, sonnet, and opus', async () => {
      const app = createApp();
      const res = await request(app).get('/models');

      const keys = res.body.models.map((m: { key: string }) => m.key);
      expect(keys).toContain('haiku');
      expect(keys).toContain('sonnet');
      expect(keys).toContain('opus');
    });
  });
});
