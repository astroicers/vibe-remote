import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

// Mock config
vi.mock('../config.js', () => ({
  config: {
    CLAUDE_CLI_PATH: 'claude',
    CLAUDE_PERMISSION_MODE: 'bypassPermissions',
  },
}));

// Mock child_process
const mockSpawn = vi.fn();
const mockExec = vi.fn();

vi.mock('child_process', () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
  exec: (...args: unknown[]) => mockExec(...args),
}));

vi.mock('util', () => ({
  promisify: (fn: unknown) => fn,
}));

import { ClaudeCliRunner, StreamEvent } from './claude-cli.js';

describe('ClaudeCliRunner', () => {
  let runner: ClaudeCliRunner;
  let mockProcess: {
    stdout: EventEmitter;
    stderr: EventEmitter;
    on: ReturnType<typeof vi.fn>;
    kill: ReturnType<typeof vi.fn>;
    killed: boolean;
  };

  beforeEach(() => {
    runner = new ClaudeCliRunner();

    // Create mock process
    mockProcess = {
      stdout: new EventEmitter(),
      stderr: new EventEmitter(),
      on: vi.fn(),
      kill: vi.fn(),
      killed: false,
    };

    mockSpawn.mockReturnValue(mockProcess);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('run', () => {
    it('should spawn claude CLI with correct arguments', async () => {
      // Set up process to close successfully
      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 0);
        }
        return mockProcess;
      });

      const runPromise = runner.run('test prompt', {
        workspacePath: '/test/workspace',
      });

      // Let the promise settle
      await runPromise;

      expect(mockSpawn).toHaveBeenCalledWith(
        'claude',
        expect.arrayContaining([
          '-p', 'test prompt',
          '--output-format', 'stream-json',
          '--verbose',
          '--max-turns', '10',
          '--dangerously-skip-permissions',
        ]),
        expect.objectContaining({
          cwd: '/test/workspace',
        })
      );
    });

    it('should include system prompt when provided', async () => {
      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 0);
        }
        return mockProcess;
      });

      const runPromise = runner.run('test', {
        workspacePath: '/test',
        systemPrompt: 'You are a helpful assistant',
      });

      await runPromise;

      expect(mockSpawn).toHaveBeenCalledWith(
        'claude',
        expect.arrayContaining([
          '--system-prompt', 'You are a helpful assistant',
        ]),
        expect.anything()
      );
    });

    it('should use custom maxTurns', async () => {
      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 0);
        }
        return mockProcess;
      });

      const runPromise = runner.run('test', {
        workspacePath: '/test',
        maxTurns: 5,
      });

      await runPromise;

      expect(mockSpawn).toHaveBeenCalledWith(
        'claude',
        expect.arrayContaining(['--max-turns', '5']),
        expect.anything()
      );
    });

    it('should emit text events from stream', async () => {
      const events: StreamEvent[] = [];
      runner.on('event', (event: StreamEvent) => events.push(event));

      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10);
        }
        return mockProcess;
      });

      const runPromise = runner.run('test', { workspacePath: '/test' });

      // Simulate NDJSON output
      const jsonEvent = {
        type: 'content_block_delta',
        delta: { type: 'text_delta', text: 'Hello ' },
      };
      mockProcess.stdout.emit('data', Buffer.from(JSON.stringify(jsonEvent) + '\n'));

      const jsonEvent2 = {
        type: 'content_block_delta',
        delta: { type: 'text_delta', text: 'World!' },
      };
      mockProcess.stdout.emit('data', Buffer.from(JSON.stringify(jsonEvent2) + '\n'));

      const result = await runPromise;

      expect(result.fullText).toBe('Hello World!');
      expect(events.filter((e) => e.type === 'text')).toHaveLength(2);
    });

    it('should emit error events from stderr', async () => {
      const events: StreamEvent[] = [];
      runner.on('event', (event: StreamEvent) => events.push(event));

      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10);
        }
        return mockProcess;
      });

      const runPromise = runner.run('test', { workspacePath: '/test' });

      // Simulate error output (not common messages)
      mockProcess.stderr.emit('data', Buffer.from('Some error occurred'));

      await runPromise;

      const errorEvents = events.filter((e) => e.type === 'error');
      expect(errorEvents).toHaveLength(1);
      expect(errorEvents[0].content).toContain('Some error occurred');
    });

    it('should filter out common non-error stderr messages', async () => {
      const events: StreamEvent[] = [];
      runner.on('event', (event: StreamEvent) => events.push(event));

      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10);
        }
        return mockProcess;
      });

      const runPromise = runner.run('test', { workspacePath: '/test' });

      // These should be filtered out
      mockProcess.stderr.emit('data', Buffer.from('Compiling TypeScript...'));
      mockProcess.stderr.emit('data', Buffer.from('Watching for changes'));

      await runPromise;

      const errorEvents = events.filter((e) => e.type === 'error');
      expect(errorEvents).toHaveLength(0);
    });

    it('should reject on non-zero exit code', async () => {
      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(1), 0);
        }
        return mockProcess;
      });

      await expect(
        runner.run('test', { workspacePath: '/test' })
      ).rejects.toThrow('Claude CLI exited with code 1');
    });

    it('should reject on spawn error', async () => {
      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('ENOENT: command not found')), 0);
        }
        return mockProcess;
      });

      await expect(
        runner.run('test', { workspacePath: '/test' })
      ).rejects.toThrow('Failed to spawn Claude CLI');
    });

    it('should emit done event on completion', async () => {
      const events: StreamEvent[] = [];
      runner.on('event', (event: StreamEvent) => events.push(event));

      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 0);
        }
        return mockProcess;
      });

      await runner.run('test', { workspacePath: '/test' });

      const doneEvents = events.filter((e) => e.type === 'done');
      expect(doneEvents).toHaveLength(1);
    });
  });

  describe('abort', () => {
    it('should kill the process', async () => {
      mockProcess.on.mockImplementation((event, _callback) => {
        if (event === 'close') {
          // Don't auto-close, wait for abort
          return mockProcess;
        }
        return mockProcess;
      });

      // Start running (don't await)
      runner.run('test', { workspacePath: '/test' });

      // Abort
      runner.abort();

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('should not kill if process already killed', async () => {
      mockProcess.killed = true;

      mockProcess.on.mockImplementation(() => mockProcess);

      runner.run('test', { workspacePath: '/test' });
      runner.abort();

      expect(mockProcess.kill).not.toHaveBeenCalled();
    });
  });

  describe('token usage tracking', () => {
    it('should track token usage from usage events', async () => {
      const events: StreamEvent[] = [];
      runner.on('event', (event: StreamEvent) => events.push(event));

      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10);
        }
        return mockProcess;
      });

      const runPromise = runner.run('test', { workspacePath: '/test' });

      // Simulate usage event
      const usageEvent = {
        type: 'usage',
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_read_input_tokens: 20,
          cache_creation_input_tokens: 10,
        },
      };
      mockProcess.stdout.emit('data', Buffer.from(JSON.stringify(usageEvent) + '\n'));

      const result = await runPromise;

      expect(result.tokenUsage).toBeDefined();
      expect(result.tokenUsage?.inputTokens).toBe(100);
      expect(result.tokenUsage?.outputTokens).toBe(50);
      expect(result.tokenUsage?.cacheReadTokens).toBe(20);
      expect(result.tokenUsage?.cacheCreationTokens).toBe(10);
    });

    it('should calculate cost correctly', async () => {
      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10);
        }
        return mockProcess;
      });

      const runPromise = runner.run('test', { workspacePath: '/test' });

      // Simulate usage event with 1M tokens
      const usageEvent = {
        type: 'usage',
        usage: {
          input_tokens: 1_000_000,
          output_tokens: 1_000_000,
          cache_read_input_tokens: 1_000_000,
        },
      };
      mockProcess.stdout.emit('data', Buffer.from(JSON.stringify(usageEvent) + '\n'));

      const result = await runPromise;

      // Input: $3/MTok, Output: $15/MTok, Cache read: $0.30/MTok
      // Expected: 3 + 15 + 0.30 = 18.30
      expect(result.tokenUsage?.costUsd).toBeCloseTo(18.30, 2);
    });

    it('should emit token_usage event', async () => {
      const events: StreamEvent[] = [];
      runner.on('event', (event: StreamEvent) => events.push(event));

      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10);
        }
        return mockProcess;
      });

      const runPromise = runner.run('test', { workspacePath: '/test' });

      const usageEvent = {
        type: 'usage',
        usage: { input_tokens: 100, output_tokens: 50 },
      };
      mockProcess.stdout.emit('data', Buffer.from(JSON.stringify(usageEvent) + '\n'));

      await runPromise;

      const usageEvents = events.filter((e) => e.type === 'token_usage');
      expect(usageEvents).toHaveLength(1);
      expect(usageEvents[0].tokenUsage?.inputTokens).toBe(100);
    });

    it('should accumulate usage across multiple events', async () => {
      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10);
        }
        return mockProcess;
      });

      const runPromise = runner.run('test', { workspacePath: '/test' });

      // Simulate multiple usage events
      const usage1 = { type: 'usage', usage: { input_tokens: 100, output_tokens: 50 } };
      const usage2 = { type: 'usage', usage: { input_tokens: 200, output_tokens: 100 } };

      mockProcess.stdout.emit('data', Buffer.from(JSON.stringify(usage1) + '\n'));
      mockProcess.stdout.emit('data', Buffer.from(JSON.stringify(usage2) + '\n'));

      const result = await runPromise;

      expect(result.tokenUsage?.inputTokens).toBe(300);
      expect(result.tokenUsage?.outputTokens).toBe(150);
    });
  });

  describe('handleEvent', () => {
    it('should track modified files from system messages', async () => {
      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10);
        }
        return mockProcess;
      });

      const runPromise = runner.run('test', { workspacePath: '/test' });

      // Simulate file modification event
      const systemEvent = {
        type: 'system',
        message: 'Wrote src/index.ts',
      };
      mockProcess.stdout.emit('data', Buffer.from(JSON.stringify(systemEvent) + '\n'));

      const result = await runPromise;

      expect(result.modifiedFiles).toContain('src/index.ts');
    });

    it('should track created files from system messages', async () => {
      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10);
        }
        return mockProcess;
      });

      const runPromise = runner.run('test', { workspacePath: '/test' });

      const systemEvent = {
        type: 'system',
        message: 'Created new-file.ts',
      };
      mockProcess.stdout.emit('data', Buffer.from(JSON.stringify(systemEvent) + '\n'));

      const result = await runPromise;

      expect(result.modifiedFiles).toContain('new-file.ts');
    });

    it('should emit tool_use events', async () => {
      const events: StreamEvent[] = [];
      runner.on('event', (event: StreamEvent) => events.push(event));

      mockProcess.on.mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10);
        }
        return mockProcess;
      });

      const runPromise = runner.run('test', { workspacePath: '/test' });

      const toolEvent = {
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              name: 'read_file',
              input: { path: 'src/index.ts' },
            },
          ],
        },
      };
      mockProcess.stdout.emit('data', Buffer.from(JSON.stringify(toolEvent) + '\n'));

      await runPromise;

      const toolEvents = events.filter((e) => e.type === 'tool_use');
      expect(toolEvents).toHaveLength(1);
      expect(toolEvents[0].toolName).toBe('read_file');
      expect(toolEvents[0].toolInput).toEqual({ path: 'src/index.ts' });
    });
  });
});
