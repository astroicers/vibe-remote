import { describe, it, expect, vi, afterAll } from 'vitest';

// Mock all heavy dependencies to isolate the interval export test
vi.mock('../auth/jwt.js', () => ({
  verifyToken: vi.fn(),
}));

vi.mock('../db/index.js', () => ({
  getDb: vi.fn(),
  generateId: vi.fn(),
}));

vi.mock('../workspace/index.js', () => ({
  getWorkspace: vi.fn(),
}));

vi.mock('../ai/claude-sdk.js', () => ({
  ClaudeSdkRunner: vi.fn(),
  StreamEvent: {},
}));

vi.mock('../ai/models.js', () => ({
  resolveModelId: vi.fn(),
}));

vi.mock('../routes/chat.js', () => ({
  getConversationHistory: vi.fn(),
  saveMessage: vi.fn(),
  updateConversationTitle: vi.fn(),
}));

vi.mock('./tool-approval.js', () => ({
  toolApprovalStore: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
  formatToolForDisplay: vi.fn(),
}));

vi.mock('../utils/truncate.js', () => ({
  truncateForHistory: vi.fn(),
  truncateHistory: vi.fn(),
  checkFileSize: vi.fn(),
  formatFileSize: vi.fn(),
  LIMITS: { MAX_MESSAGE_LENGTH: 10000 },
}));

vi.mock('../workspace/watcher.js', () => ({
  getWatcher: vi.fn().mockReturnValue({ onChanges: vi.fn() }),
}));

vi.mock('../diff/manager.js', () => ({
  createDiffReview: vi.fn(),
}));

vi.mock('../utils/timeout.js', () => ({
  withTimeout: vi.fn(),
}));

vi.mock('../config.js', () => ({
  config: {
    RUNNER_TIMEOUT_MS: 60000,
  },
}));

import { staleRunnerCleanupInterval } from './chat-handler.js';

describe('staleRunnerCleanupInterval', () => {
  afterAll(() => {
    clearInterval(staleRunnerCleanupInterval);
  });

  it('should be exported and be a valid interval handle', () => {
    expect(staleRunnerCleanupInterval).toBeDefined();
    // Node.js interval returns a Timeout object
    expect(typeof staleRunnerCleanupInterval).toBe('object');
  });

  it('should be clearable without error', () => {
    expect(() => clearInterval(staleRunnerCleanupInterval)).not.toThrow();
  });
});
