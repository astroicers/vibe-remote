import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Task } from './manager.js';

// Mock config for models module and runner
vi.mock('../config.js', () => ({
  config: {
    CLAUDE_MODEL: 'claude-sonnet-4-20250514',
    RUNNER_TIMEOUT_MS: 600000,
    MAX_TURNS_TASK: 30,
  },
}));

// Mock ClaudeSdkRunner
const mockRun = vi.fn();

vi.mock('../ai/claude-sdk.js', () => {
  return {
    ClaudeSdkRunner: class MockClaudeSdkRunner {
      run = mockRun;
    },
  };
});

// Mock getWorkspace
const mockGetWorkspace = vi.fn();

vi.mock('../workspace/manager.js', () => ({
  getWorkspace: (...args: unknown[]) => mockGetWorkspace(...args),
}));

// Import after mocks are defined
import { runTask } from './runner.js';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task_1',
    workspace_id: 'ws_1',
    title: 'Test task',
    description: 'Implement the feature',
    status: 'running',
    priority: 'normal',
    progress: null,
    branch: null,
    depends_on: null,
    context_files: null,
    result: null,
    error: null,
    created_at: '2025-01-01T00:00:00Z',
    started_at: '2025-01-01T00:00:00Z',
    completed_at: null,
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('runTask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return error when workspace is not found', async () => {
    mockGetWorkspace.mockReturnValue(null);

    const task = makeTask({ workspace_id: 'ws_missing' });
    const result = await runTask(task);

    expect(result).toEqual({ error: 'Workspace not found: ws_missing' });
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('should build correct prompt from task description', async () => {
    mockGetWorkspace.mockReturnValue({
      id: 'ws_1',
      name: 'Test Project',
      path: '/home/user/test-project',
      isActive: true,
      systemPrompt: null,
      createdAt: '2025-01-01T00:00:00Z',
    });
    mockRun.mockResolvedValue({ fullText: 'Done', modifiedFiles: [] });

    const task = makeTask({ description: 'Add login page' });
    await runTask(task);

    expect(mockRun).toHaveBeenCalledWith('Add login page', {
      workspacePath: '/home/user/test-project',
      systemPrompt: undefined,
      permissionMode: 'bypassPermissions',
      maxTurns: 30,
      model: 'claude-sonnet-4-20250514',
    });
  });

  it('should append context_files to prompt when present', async () => {
    mockGetWorkspace.mockReturnValue({
      id: 'ws_1',
      name: 'Test Project',
      path: '/home/user/test-project',
      isActive: true,
      systemPrompt: 'You are a helpful assistant',
      createdAt: '2025-01-01T00:00:00Z',
    });
    mockRun.mockResolvedValue({ fullText: 'Done', modifiedFiles: [] });

    const task = makeTask({
      description: 'Fix the bug',
      context_files: JSON.stringify(['src/app.ts', 'src/utils.ts']),
    });
    await runTask(task);

    const expectedPrompt = 'Fix the bug\n\nContext files to focus on:\n- src/app.ts\n- src/utils.ts';
    expect(mockRun).toHaveBeenCalledWith(expectedPrompt, {
      workspacePath: '/home/user/test-project',
      systemPrompt: 'You are a helpful assistant',
      permissionMode: 'bypassPermissions',
      maxTurns: 30,
      model: 'claude-sonnet-4-20250514',
    });
  });

  it('should not append context_files when null', async () => {
    mockGetWorkspace.mockReturnValue({
      id: 'ws_1',
      name: 'Test Project',
      path: '/home/user/test-project',
      isActive: true,
      systemPrompt: null,
      createdAt: '2025-01-01T00:00:00Z',
    });
    mockRun.mockResolvedValue({ fullText: 'Done', modifiedFiles: [] });

    const task = makeTask({ description: 'Do something', context_files: null });
    await runTask(task);

    expect(mockRun).toHaveBeenCalledWith('Do something', expect.objectContaining({
      workspacePath: '/home/user/test-project',
    }));
  });

  it('should handle invalid JSON in context_files without crashing', async () => {
    mockGetWorkspace.mockReturnValue({
      id: 'ws_1',
      name: 'Test Project',
      path: '/home/user/test-project',
      isActive: true,
      systemPrompt: null,
      createdAt: '2025-01-01T00:00:00Z',
    });
    mockRun.mockResolvedValue({ fullText: 'Done', modifiedFiles: [] });

    const task = makeTask({
      description: 'Do something',
      context_files: 'not-valid-json{{{',
    });
    const result = await runTask(task);

    // Should not crash and should proceed with the task
    expect(result).toEqual({ result: 'Done' });
    // Prompt should be just the description (no context files appended)
    expect(mockRun).toHaveBeenCalledWith('Do something', expect.any(Object));
  });

  it('should return result when ClaudeSdkRunner.run succeeds', async () => {
    mockGetWorkspace.mockReturnValue({
      id: 'ws_1',
      name: 'Test Project',
      path: '/home/user/test-project',
      isActive: true,
      systemPrompt: null,
      createdAt: '2025-01-01T00:00:00Z',
    });
    mockRun.mockResolvedValue({
      fullText: 'Successfully implemented the feature with 3 files modified.',
      modifiedFiles: ['src/a.ts', 'src/b.ts', 'src/c.ts'],
    });

    const task = makeTask();
    const result = await runTask(task);

    expect(result).toEqual({ result: 'Successfully implemented the feature with 3 files modified.' });
  });

  it('should return fallback result when fullText is empty', async () => {
    mockGetWorkspace.mockReturnValue({
      id: 'ws_1',
      name: 'Test Project',
      path: '/home/user/test-project',
      isActive: true,
      systemPrompt: null,
      createdAt: '2025-01-01T00:00:00Z',
    });
    mockRun.mockResolvedValue({
      fullText: '',
      modifiedFiles: [],
    });

    const task = makeTask();
    const result = await runTask(task);

    expect(result).toEqual({ result: 'Task completed successfully' });
  });

  it('should return error when ClaudeSdkRunner.run throws', async () => {
    mockGetWorkspace.mockReturnValue({
      id: 'ws_1',
      name: 'Test Project',
      path: '/home/user/test-project',
      isActive: true,
      systemPrompt: null,
      createdAt: '2025-01-01T00:00:00Z',
    });
    mockRun.mockRejectedValue(new Error('Claude API rate limit exceeded'));

    const task = makeTask();
    const result = await runTask(task);

    expect(result).toEqual({ error: 'Claude API rate limit exceeded' });
  });

  it('should handle non-Error throw from ClaudeSdkRunner.run', async () => {
    mockGetWorkspace.mockReturnValue({
      id: 'ws_1',
      name: 'Test Project',
      path: '/home/user/test-project',
      isActive: true,
      systemPrompt: null,
      createdAt: '2025-01-01T00:00:00Z',
    });
    mockRun.mockRejectedValue('string error');

    const task = makeTask();
    const result = await runTask(task);

    expect(result).toEqual({ error: 'Unknown error during task execution' });
  });
});
