import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WorkspaceWatcher } from './watcher.js';

// Mock chokidar
vi.mock('chokidar', () => {
  const eventHandlers: Record<string, (path: string) => void> = {};
  const mockWatcher = {
    on: vi.fn((event: string, handler: (path: string) => void) => {
      eventHandlers[event] = handler;
      return mockWatcher;
    }),
    close: vi.fn(),
    __emit: (event: string, path: string) => {
      eventHandlers[event]?.(path);
    },
    __handlers: eventHandlers,
  };

  return {
    default: {
      watch: vi.fn(() => mockWatcher),
      __mockWatcher: mockWatcher,
    },
  };
});

// Mock fs
vi.mock('fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => ''),
}));

import chokidar from 'chokidar';

describe('WorkspaceWatcher', () => {
  let watcher: WorkspaceWatcher;

  beforeEach(() => {
    vi.useFakeTimers();
    watcher = new WorkspaceWatcher(100); // 100ms debounce for tests
    vi.clearAllMocks();
  });

  afterEach(() => {
    watcher.unwatchAll();
    vi.useRealTimers();
  });

  describe('watch/unwatch lifecycle', () => {
    it('should start watching a workspace', () => {
      watcher.watch('ws-1', '/home/user/project');

      expect(chokidar.watch).toHaveBeenCalledWith(
        '/home/user/project',
        expect.objectContaining({
          persistent: true,
          ignoreInitial: true,
        })
      );
      expect(watcher.isWatching('ws-1')).toBe(true);
    });

    it('should not double-watch the same workspace', () => {
      watcher.watch('ws-1', '/home/user/project');
      watcher.watch('ws-1', '/home/user/project');

      expect(chokidar.watch).toHaveBeenCalledTimes(1);
    });

    it('should stop watching a workspace', () => {
      watcher.watch('ws-1', '/home/user/project');
      expect(watcher.isWatching('ws-1')).toBe(true);

      watcher.unwatch('ws-1');
      expect(watcher.isWatching('ws-1')).toBe(false);
    });

    it('should stop watching all workspaces', () => {
      watcher.watch('ws-1', '/home/user/project1');
      watcher.watch('ws-2', '/home/user/project2');

      expect(watcher.isWatching('ws-1')).toBe(true);
      expect(watcher.isWatching('ws-2')).toBe(true);

      watcher.unwatchAll();

      expect(watcher.isWatching('ws-1')).toBe(false);
      expect(watcher.isWatching('ws-2')).toBe(false);
    });

    it('should handle unwatching a non-watched workspace', () => {
      // Should not throw
      expect(() => watcher.unwatch('nonexistent')).not.toThrow();
    });
  });

  describe('debouncing', () => {
    it('should debounce multiple changes into a single callback', () => {
      const callback = vi.fn();
      watcher.onChanges(callback);
      watcher.watch('ws-1', '/home/user/project');

      const mockWatcher = (chokidar as unknown as { __mockWatcher: { __emit: (event: string, path: string) => void } }).__mockWatcher;

      // Emit multiple changes rapidly
      mockWatcher.__emit('change', '/home/user/project/src/index.ts');
      mockWatcher.__emit('change', '/home/user/project/src/app.ts');
      mockWatcher.__emit('add', '/home/user/project/src/new-file.ts');

      // Callback should not have been called yet
      expect(callback).not.toHaveBeenCalled();

      // Advance past debounce
      vi.advanceTimersByTime(150);

      // Should be called once with all changes
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('ws-1', expect.arrayContaining([
        expect.objectContaining({ type: 'change', relativePath: 'src/index.ts' }),
        expect.objectContaining({ type: 'change', relativePath: 'src/app.ts' }),
        expect.objectContaining({ type: 'add', relativePath: 'src/new-file.ts' }),
      ]));
    });

    it('should reset debounce timer on new changes', () => {
      const callback = vi.fn();
      watcher.onChanges(callback);
      watcher.watch('ws-1', '/home/user/project');

      const mockWatcher = (chokidar as unknown as { __mockWatcher: { __emit: (event: string, path: string) => void } }).__mockWatcher;

      // Emit first change
      mockWatcher.__emit('change', '/home/user/project/src/a.ts');

      // Wait 80ms (less than 100ms debounce)
      vi.advanceTimersByTime(80);
      expect(callback).not.toHaveBeenCalled();

      // Emit another change — should reset debounce
      mockWatcher.__emit('change', '/home/user/project/src/b.ts');

      // Advance another 80ms (total 160ms from first, 80ms from second)
      vi.advanceTimersByTime(80);
      expect(callback).not.toHaveBeenCalled();

      // Advance to past debounce from second event
      vi.advanceTimersByTime(30);
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('ws-1', expect.arrayContaining([
        expect.objectContaining({ relativePath: 'src/a.ts' }),
        expect.objectContaining({ relativePath: 'src/b.ts' }),
      ]));
    });
  });

  describe('change event callback', () => {
    it('should not call callback if no callback is set', () => {
      watcher.watch('ws-1', '/home/user/project');

      const mockWatcher = (chokidar as unknown as { __mockWatcher: { __emit: (event: string, path: string) => void } }).__mockWatcher;
      mockWatcher.__emit('change', '/home/user/project/src/index.ts');

      // Should not throw
      vi.advanceTimersByTime(150);
    });

    it('should not call callback for empty changes', () => {
      const callback = vi.fn();
      watcher.onChanges(callback);
      watcher.watch('ws-1', '/home/user/project');

      // Advance without emitting — no callback
      vi.advanceTimersByTime(150);
      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle unlink events', () => {
      const callback = vi.fn();
      watcher.onChanges(callback);
      watcher.watch('ws-1', '/home/user/project');

      const mockWatcher = (chokidar as unknown as { __mockWatcher: { __emit: (event: string, path: string) => void } }).__mockWatcher;
      mockWatcher.__emit('unlink', '/home/user/project/src/deleted.ts');

      vi.advanceTimersByTime(150);

      expect(callback).toHaveBeenCalledWith('ws-1', [
        expect.objectContaining({ type: 'unlink', relativePath: 'src/deleted.ts' }),
      ]);
    });
  });
});
