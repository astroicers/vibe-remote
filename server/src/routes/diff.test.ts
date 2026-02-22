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

vi.mock('../ws/index.js', () => {
  const runners = new Map();
  return {
    broadcastTaskStatus: vi.fn(),
    sendFeedbackToAI: vi.fn().mockResolvedValue(undefined),
    activeRunners: runners,
    MAX_CONCURRENT_RUNNERS: 3,
  };
});

vi.mock('../workspace/index.js', () => ({
  getWorkspace: (id: string) => {
    if (id === 'ws_test') {
      return { id: 'ws_test', name: 'Test Project', path: '/test/path', systemPrompt: null };
    }
    return null;
  },
}));

vi.mock('../workspace/git-ops.js', () => ({
  getGitDiff: vi.fn().mockResolvedValue(''),
  stageFiles: vi.fn().mockResolvedValue(undefined),
  discardChanges: vi.fn().mockResolvedValue(undefined),
}));

import diffRoutes from './diff.js';
import { sendFeedbackToAI, activeRunners } from '../ws/index.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/diff', diffRoutes);
  return app;
}

function seedWorkspace() {
  mockDb.prepare(
    "INSERT INTO workspaces (id, name, path) VALUES (?, ?, ?)"
  ).run('ws_test', 'Test Project', '/test/path');
}

function createConversation(id: string = 'conv_test') {
  mockDb.prepare(
    "INSERT INTO conversations (id, workspace_id, title) VALUES (?, ?, ?)"
  ).run(id, 'ws_test', 'Test Conversation');
  return id;
}

function createDiffReview(overrides: Record<string, unknown> = {}) {
  const id = (overrides.id as string) || `diff_test_${Date.now()}`;
  const conversationId = 'conversationId' in overrides ? overrides.conversationId : 'conv_test';
  const defaults = {
    id,
    conversation_id: conversationId,
    workspace_id: 'ws_test',
    status: 'pending',
    files_json: JSON.stringify([{ path: 'src/foo.ts', status: 'modified', insertions: 5, deletions: 2, hunks: [], isBinary: false }]),
  };
  const data = { ...defaults, ...overrides };
  mockDb.prepare(`
    INSERT INTO diff_reviews (id, conversation_id, workspace_id, status, files_json)
    VALUES (?, ?, ?, ?, ?)
  `).run(data.id, data.conversation_id, data.workspace_id, data.status, data.files_json);
  return data;
}

function addComment(diffReviewId: string, content: string, filePath: string = 'src/foo.ts', author: string = 'user') {
  const id = `cmt_test_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  mockDb.prepare(`
    INSERT INTO diff_comments (id, diff_review_id, file_path, content, author)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, diffReviewId, filePath, content, author);
  return id;
}

describe('Diff Feedback Routes', () => {
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

      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        title TEXT,
        token_usage TEXT,
        sdk_session_id TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        tool_calls TEXT,
        tool_results TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS diff_reviews (
        id TEXT PRIMARY KEY,
        conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        files_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'approved', 'rejected', 'partial')),
        commit_message TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS diff_comments (
        id TEXT PRIMARY KEY,
        diff_review_id TEXT NOT NULL REFERENCES diff_reviews(id) ON DELETE CASCADE,
        file_path TEXT NOT NULL,
        line_number INTEGER,
        content TEXT NOT NULL,
        author TEXT NOT NULL CHECK (author IN ('user', 'ai')),
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);

    seedWorkspace();
    app = createApp();

    // Reset mocks
    vi.mocked(sendFeedbackToAI).mockClear();
    (activeRunners as Map<string, unknown>).clear();
  });

  afterEach(() => {
    mockDb.close();
    vi.restoreAllMocks();
  });

  describe('POST /diff/reviews/:id/feedback', () => {
    it('should return 202 with valid review and user comments', async () => {
      const convId = createConversation();
      const review = createDiffReview({ conversationId: convId });
      addComment(review.id, 'Fix this variable name');
      addComment(review.id, 'Handle null input');

      const res = await request(app)
        .post(`/diff/reviews/${review.id}/feedback`)
        .send({});

      expect(res.status).toBe(202);
      expect(res.body.status).toBe('processing');
      expect(res.body.conversationId).toBe(convId);
      expect(res.body.message).toContain('Feedback sent to AI');

      // Verify sendFeedbackToAI was called
      expect(vi.mocked(sendFeedbackToAI)).toHaveBeenCalledOnce();
      expect(vi.mocked(sendFeedbackToAI)).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws_test',
          conversationId: convId,
          originalReviewId: review.id,
        })
      );
    });

    it('should return 404 for nonexistent review', async () => {
      const res = await request(app)
        .post('/diff/reviews/nonexistent/feedback')
        .send({});

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });

    it('should return 400 for review with no user comments', async () => {
      const convId = createConversation();
      const review = createDiffReview({ conversationId: convId });
      // Add only an AI comment (not a user comment)
      addComment(review.id, 'AI suggestion', 'src/foo.ts', 'ai');

      const res = await request(app)
        .post(`/diff/reviews/${review.id}/feedback`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('NO_COMMENTS');
    });

    it('should return 400 when filePathFilter results in no matching comments', async () => {
      const convId = createConversation();
      const review = createDiffReview({ conversationId: convId });
      addComment(review.id, 'Fix this', 'src/foo.ts');

      const res = await request(app)
        .post(`/diff/reviews/${review.id}/feedback`)
        .send({ filePathFilter: ['src/bar.ts'] });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('NO_COMMENTS');
    });

    it('should filter comments by filePathFilter', async () => {
      const convId = createConversation();
      const review = createDiffReview({ conversationId: convId });
      addComment(review.id, 'Fix foo', 'src/foo.ts');
      addComment(review.id, 'Fix bar', 'src/bar.ts');

      const res = await request(app)
        .post(`/diff/reviews/${review.id}/feedback`)
        .send({ filePathFilter: ['src/foo.ts'] });

      expect(res.status).toBe(202);

      // Verify prompt only contains foo.ts comments
      const callArgs = vi.mocked(sendFeedbackToAI).mock.calls[0][0];
      expect(callArgs.prompt).toContain('src/foo.ts');
      expect(callArgs.prompt).toContain('Fix foo');
      expect(callArgs.prompt).not.toContain('Fix bar');
    });

    it('should create conversation when review has no conversationId', async () => {
      const review = createDiffReview({ conversationId: null });
      addComment(review.id, 'Fix this');

      const res = await request(app)
        .post(`/diff/reviews/${review.id}/feedback`)
        .send({});

      expect(res.status).toBe(202);
      // A new conversation should have been created
      expect(res.body.conversationId).toBeTruthy();
      expect(res.body.conversationId).not.toBe('');

      // Verify conversation was created in DB
      const conv = mockDb.prepare('SELECT id FROM conversations WHERE id = ?')
        .get(res.body.conversationId);
      expect(conv).toBeTruthy();
    });

    it('should return 409 when conversation already has active runner', async () => {
      const convId = createConversation();
      const review = createDiffReview({ conversationId: convId });
      addComment(review.id, 'Fix this');

      // Simulate active runner
      (activeRunners as Map<string, unknown>).set(`ws_test:${convId}`, { runner: {}, workspaceId: 'ws_test', conversationId: convId });

      const res = await request(app)
        .post(`/diff/reviews/${review.id}/feedback`)
        .send({});

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('RUNNER_BUSY');
    });

    it('should return 429 when max concurrent runners reached', async () => {
      const convId = createConversation();
      const review = createDiffReview({ conversationId: convId });
      addComment(review.id, 'Fix this');

      // Fill up all runner slots
      (activeRunners as Map<string, unknown>).set('ws1:conv1', { runner: {}, workspaceId: 'ws1', conversationId: 'conv1' });
      (activeRunners as Map<string, unknown>).set('ws2:conv2', { runner: {}, workspaceId: 'ws2', conversationId: 'conv2' });
      (activeRunners as Map<string, unknown>).set('ws3:conv3', { runner: {}, workspaceId: 'ws3', conversationId: 'conv3' });

      const res = await request(app)
        .post(`/diff/reviews/${review.id}/feedback`)
        .send({});

      expect(res.status).toBe(429);
      expect(res.body.code).toBe('RATE_LIMIT');
    });

    it('should include re-implement note when review status is rejected', async () => {
      const convId = createConversation();
      const review = createDiffReview({ conversationId: convId, status: 'rejected' });
      addComment(review.id, 'Fix the approach');

      const res = await request(app)
        .post(`/diff/reviews/${review.id}/feedback`)
        .send({});

      expect(res.status).toBe(202);

      const callArgs = vi.mocked(sendFeedbackToAI).mock.calls[0][0];
      expect(callArgs.prompt).toContain('previous changes were discarded');
    });
  });
});
