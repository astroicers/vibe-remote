import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTaskStore } from '../stores/tasks';
import { useToastStore } from '../stores/toast';

// Mock ws.on — capture handler for manual invocation
const mockUnsubscribe = vi.fn();
let capturedHandler: ((data: Record<string, unknown>) => void) | null = null;

vi.mock('../services/websocket', () => ({
  ws: {
    on: vi.fn((type: string, handler: (data: Record<string, unknown>) => void) => {
      if (type === 'task_status') {
        capturedHandler = handler;
      }
      return mockUnsubscribe;
    }),
  },
}));

// Import after mocks are set up
import { ws } from '../services/websocket';
import { useTaskWebSocket } from './useTaskWebSocket';

function makeTask(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'task-1',
    workspace_id: 'ws-1',
    title: 'Test task',
    description: 'A test task',
    status: 'pending' as const,
    priority: 'normal' as const,
    progress: null,
    branch: null,
    depends_on: null,
    dependency_status: 'ready' as const,
    context_files: null,
    result: null,
    error: null,
    created_at: '2026-02-22T00:00:00Z',
    started_at: null,
    completed_at: null,
    updated_at: '2026-02-22T00:00:00Z',
    ...overrides,
  };
}

describe('useTaskWebSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedHandler = null;
    useTaskStore.setState({ tasksByWorkspace: {}, isLoading: false, error: null });
    useToastStore.setState({ toasts: [] });
  });

  it('subscribes to task_status on mount', () => {
    renderHook(() => useTaskWebSocket());
    expect(ws.on).toHaveBeenCalledWith('task_status', expect.any(Function));
  });

  it('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useTaskWebSocket());
    expect(mockUnsubscribe).not.toHaveBeenCalled();
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('calls handleTaskStatusUpdate when a valid task_status event arrives', () => {
    const spy = vi.spyOn(useTaskStore.getState(), 'handleTaskStatusUpdate');
    renderHook(() => useTaskWebSocket());

    const task = makeTask();
    capturedHandler!({ task });

    // handleTaskStatusUpdate is called via getState(), so check store state instead
    const wsState = useTaskStore.getState().tasksByWorkspace['ws-1'];
    expect(wsState).toBeDefined();
    expect(wsState.tasks).toHaveLength(1);
    expect(wsState.tasks[0].id).toBe('task-1');

    spy.mockRestore();
  });

  it('shows success toast for completed tasks', () => {
    renderHook(() => useTaskWebSocket());

    const task = makeTask({ status: 'completed', title: 'Build feature' });
    capturedHandler!({ task });

    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe('Task completed: Build feature');
    expect(toasts[0].type).toBe('success');
  });

  it('shows error toast for failed tasks', () => {
    renderHook(() => useTaskWebSocket());

    const task = makeTask({ status: 'failed', title: 'Deploy app' });
    capturedHandler!({ task });

    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe('Task failed: Deploy app');
    expect(toasts[0].type).toBe('error');
  });

  it('does not toast for non-terminal statuses', () => {
    renderHook(() => useTaskWebSocket());

    capturedHandler!({ task: makeTask({ status: 'running' }) });
    capturedHandler!({ task: makeTask({ status: 'pending' }) });
    capturedHandler!({ task: makeTask({ status: 'queued' }) });

    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('ignores event with missing task', () => {
    renderHook(() => useTaskWebSocket());

    capturedHandler!({});
    capturedHandler!({ task: undefined });

    expect(useTaskStore.getState().tasksByWorkspace).toEqual({});
  });

  it('ignores task missing id', () => {
    renderHook(() => useTaskWebSocket());

    capturedHandler!({ task: { workspace_id: 'ws-1' } });

    expect(useTaskStore.getState().tasksByWorkspace).toEqual({});
  });

  it('ignores task missing workspace_id', () => {
    renderHook(() => useTaskWebSocket());

    capturedHandler!({ task: { id: 'task-1' } });

    expect(useTaskStore.getState().tasksByWorkspace).toEqual({});
  });
});
