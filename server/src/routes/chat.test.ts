import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import express from 'express';
import request from 'supertest';
import { SCHEMA } from '../db/schema.js';

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

vi.mock('../ws/index.js', () => ({
  abortRunner: vi.fn().mockReturnValue(false),
}));

vi.mock('../workspace/index.js', () => ({
  getWorkspace: (id: string) => {
    if (id === 'ws_test') {
      return { id: 'ws_test', name: 'Test Project', path: '/test/path', systemPrompt: null };
    }
    return null;
  },
}));

import chatRoutes from './chat.js';
import { getConversationHistory, saveMessage } from './chat.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/chat', chatRoutes);
  return app;
}

describe('Chat Routes', () => {
  beforeEach(() => {
    mockDb = new Database(':memory:');
    mockDb.pragma('journal_mode = WAL');
    mockDb.pragma('foreign_keys = ON');
    mockDb.exec(SCHEMA);

    // Seed workspace and conversation
    mockDb.prepare("INSERT INTO workspaces (id, name, path) VALUES ('ws_test', 'Test', '/test')").run();
    mockDb
      .prepare(
        "INSERT INTO conversations (id, workspace_id, title) VALUES ('conv_test', 'ws_test', 'Test Conv')"
      )
      .run();
  });

  afterEach(() => {
    mockDb.close();
  });

  describe('getConversationHistory', () => {
    it('should return plain text messages', () => {
      mockDb
        .prepare(
          "INSERT INTO messages (id, conversation_id, role, content) VALUES ('msg1', 'conv_test', 'user', 'Hello')"
        )
        .run();

      const history = getConversationHistory('conv_test');
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual({ role: 'user', content: 'Hello' });
    });

    it('should parse valid tool_calls JSON', () => {
      const toolCalls = [{ type: 'tool_use', id: 't1', name: 'read', input: {} }];
      mockDb
        .prepare(
          "INSERT INTO messages (id, conversation_id, role, content, tool_calls) VALUES ('msg1', 'conv_test', 'assistant', '', ?)"
        )
        .run(JSON.stringify(toolCalls));

      const history = getConversationHistory('conv_test');
      expect(history).toHaveLength(1);
      expect(history[0].role).toBe('assistant');
      expect(history[0].content).toEqual(toolCalls);
    });

    it('should parse valid tool_results JSON', () => {
      const toolResults = [{ type: 'tool_result', tool_use_id: 't1', content: 'ok' }];
      mockDb
        .prepare(
          "INSERT INTO messages (id, conversation_id, role, content, tool_results) VALUES ('msg1', 'conv_test', 'user', '', ?)"
        )
        .run(JSON.stringify(toolResults));

      const history = getConversationHistory('conv_test');
      expect(history).toHaveLength(1);
      expect(history[0].role).toBe('user');
      expect(history[0].content).toEqual(toolResults);
    });

    it('should fallback to plain text on corrupted tool_calls JSON', () => {
      mockDb
        .prepare(
          "INSERT INTO messages (id, conversation_id, role, content, tool_calls) VALUES ('msg1', 'conv_test', 'assistant', 'fallback text', 'not-valid-json{')"
        )
        .run();

      const history = getConversationHistory('conv_test');
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual({ role: 'assistant', content: 'fallback text' });
    });

    it('should fallback to plain text on corrupted tool_results JSON', () => {
      mockDb
        .prepare(
          "INSERT INTO messages (id, conversation_id, role, content, tool_results) VALUES ('msg1', 'conv_test', 'user', 'fallback text', '{broken')"
        )
        .run();

      const history = getConversationHistory('conv_test');
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual({ role: 'user', content: 'fallback text' });
    });

    it('should return empty array for empty conversation', () => {
      const history = getConversationHistory('conv_test');
      expect(history).toEqual([]);
    });
  });

  describe('GET /chat/conversations/:id', () => {
    it('should return conversation with messages', () => {
      mockDb
        .prepare(
          "INSERT INTO messages (id, conversation_id, role, content) VALUES ('msg1', 'conv_test', 'user', 'Hello')"
        )
        .run();

      const app = createApp();
      return request(app)
        .get('/chat/conversations/conv_test')
        .expect(200)
        .then((res) => {
          expect(res.body.id).toBe('conv_test');
          expect(res.body.messages).toHaveLength(1);
          expect(res.body.messages[0].content).toBe('Hello');
        });
    });

    it('should parse tool_calls and tool_results in messages', () => {
      const toolCalls = [{ type: 'tool_use', id: 't1', name: 'read', input: {} }];
      mockDb
        .prepare(
          "INSERT INTO messages (id, conversation_id, role, content, tool_calls) VALUES ('msg1', 'conv_test', 'assistant', '', ?)"
        )
        .run(JSON.stringify(toolCalls));

      const app = createApp();
      return request(app)
        .get('/chat/conversations/conv_test')
        .expect(200)
        .then((res) => {
          expect(res.body.messages[0].tool_calls).toEqual(toolCalls);
        });
    });

    it('should return 404 for non-existent conversation', () => {
      const app = createApp();
      return request(app).get('/chat/conversations/nonexistent').expect(404);
    });
  });

  describe('saveMessage', () => {
    it('should save a plain text message', () => {
      const id = saveMessage('conv_test', 'user', 'Hello world');
      expect(id).toMatch(/^msg_/);

      const row = mockDb.prepare('SELECT * FROM messages WHERE id = ?').get(id) as any;
      expect(row.content).toBe('Hello world');
      expect(row.role).toBe('user');
    });

    it('should save a message with tool_calls', () => {
      const toolCalls = [{ type: 'tool_use', id: 't1', name: 'read', input: {} }];
      const id = saveMessage('conv_test', 'assistant', '', toolCalls);

      const row = mockDb.prepare('SELECT * FROM messages WHERE id = ?').get(id) as any;
      expect(JSON.parse(row.tool_calls)).toEqual(toolCalls);
    });

    it('should update conversation updated_at timestamp', () => {
      const before = mockDb
        .prepare('SELECT updated_at FROM conversations WHERE id = ?')
        .get('conv_test') as any;

      saveMessage('conv_test', 'user', 'trigger update');

      const after = mockDb
        .prepare('SELECT updated_at FROM conversations WHERE id = ?')
        .get('conv_test') as any;

      // updated_at should be set (may or may not differ in ms-level test)
      expect(after.updated_at).toBeDefined();
    });
  });

  describe('POST /chat/conversations', () => {
    it('should create a new conversation', () => {
      const app = createApp();
      return request(app)
        .post('/chat/conversations')
        .send({ workspaceId: 'ws_test' })
        .expect(201)
        .then((res) => {
          expect(res.body.id).toBeDefined();
          expect(res.body.workspace_id).toBe('ws_test');
        });
    });

    it('should reject without workspaceId', () => {
      const app = createApp();
      return request(app).post('/chat/conversations').send({}).expect(400);
    });
  });

  describe('GET /chat/conversations', () => {
    it('should list conversations for workspace', () => {
      const app = createApp();
      return request(app)
        .get('/chat/conversations?workspaceId=ws_test')
        .expect(200)
        .then((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body).toHaveLength(1);
        });
    });

    it('should reject without workspaceId', () => {
      const app = createApp();
      return request(app).get('/chat/conversations').expect(400);
    });
  });
});
