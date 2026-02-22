import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTaskStore } from '../stores/tasks';
import { useToastStore } from '../stores/toast';

// Mock ws.on — capture handlers for manual invocation
const mockUnsubscribe = vi.fn();
const capturedHandlers: Record<string, ((data: Record<string, unknown>) => void)> = {};

vi.mock('../services/websocket', () => ({
  ws: {
    on: vi.fn((type: string, handler: (data: Record<string, unknown>) => void) => {
      capturedHandlers[type] = handler;
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
    Object.keys(capturedHandlers).forEach(k => delete capturedHandlers[k]);
    useTaskStore.setState({ tasksByWorkspace: {}, isLoading: false, error: null });
    useToastStore.setState({ toasts: [] });
  });

  it('subscribes to task_status on mount', () => {
    renderHook(() => useTaskWebSocket());
    expect(ws.on).toHaveBeenCalledWith('task_status', expect.any(Function));
  });

  it('subscribes to all task event types on mount', () => {
    renderHook(() => useTaskWebSocket());
    expect(ws.on).toHaveBeenCalledWith('task_status', expect.any(Function));
    expect(ws.on).toHaveBeenCalledWith('task_progress', expect.any(Function));
    expect(ws.on).toHaveBeenCalledWith('task_tool_use', expect.any(Function));
    expect(ws.on).toHaveBeenCalledWith('task_tool_result', expect.any(Function));
    expect(ws.on).toHaveBeenCalledWith('task_complete', expect.any(Function));
    expect(ws.on).toHaveBeenCalledTimes(5);
  });

  it('unsubscribes all handlers on unmount', () => {
    const { unmount } = renderHook(() => useTaskWebSocket());
    expect(mockUnsubscribe).not.toHaveBeenCalled();
    unmount();
    // 5 subscriptions = 5 unsubscribe calls
    expect(mockUnsubscribe).toHaveBeenCalledTimes(5);
  });

  it('calls handleTaskStatusUpdate when a valid task_status event arrives', () => {
    const spy = vi.spyOn(useTaskStore.getState(), 'handleTaskStatusUpdate');
    renderHook(() => useTaskWebSocket());

    const task = makeTask();
    capturedHandlers['task_status']!({ task });

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
    capturedHandlers['task_status']!({ task });

    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe('Task completed: Build feature');
    expect(toasts[0].type).toBe('success');
  });

  it('shows error toast for failed tasks', () => {
    renderHook(() => useTaskWebSocket());

    const task = makeTask({ status: 'failed', title: 'Deploy app' });
    capturedHandlers['task_status']!({ task });

    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe('Task failed: Deploy app');
    expect(toasts[0].type).toBe('error');
  });

  it('does not toast for non-terminal statuses', () => {
    renderHook(() => useTaskWebSocket());

    capturedHandlers['task_status']!({ task: makeTask({ status: 'running' }) });
    capturedHandlers['task_status']!({ task: makeTask({ status: 'pending' }) });
    capturedHandlers['task_status']!({ task: makeTask({ status: 'queued' }) });

    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('ignores event with missing task', () => {
    renderHook(() => useTaskWebSocket());

    capturedHandlers['task_status']!({});
    capturedHandlers['task_status']!({ task: undefined });

    expect(useTaskStore.getState().tasksByWorkspace).toEqual({});
  });

  it('ignores task missing id', () => {
    renderHook(() => useTaskWebSocket());

    capturedHandlers['task_status']!({ task: { workspace_id: 'ws-1' } });

    expect(useTaskStore.getState().tasksByWorkspace).toEqual({});
  });

  it('ignores task missing workspace_id', () => {
    renderHook(() => useTaskWebSocket());

    capturedHandlers['task_status']!({ task: { id: 'task-1' } });

    expect(useTaskStore.getState().tasksByWorkspace).toEqual({});
  });

  // New tests for task streaming events

  it('handles task_progress events', () => {
    renderHook(() => useTaskWebSocket());

    capturedHandlers['task_progress']!({
      type: 'task_progress',
      taskId: 'task-1',
      workspaceId: 'ws-1',
      text: 'Processing...',
      timestamp: '2026-02-22T00:00:00Z',
    });

    const wsState = useTaskStore.getState().tasksByWorkspace['ws-1'];
    expect(wsState).toBeDefined();
    expect(wsState.activeTaskProgress['task-1']).toBeDefined();
    expect(wsState.activeTaskProgress['task-1'].currentText).toBe('Processing...');
    expect(wsState.activeTaskProgress['task-1'].chunks).toEqual(['Processing...']);
  });

  it('handles task_tool_use events', () => {
    renderHook(() => useTaskWebSocket());

    capturedHandlers['task_tool_use']!({
      type: 'task_tool_use',
      taskId: 'task-1',
      workspaceId: 'ws-1',
      tool: 'Edit',
      input: { file_path: 'src/main.ts' },
      timestamp: '2026-02-22T00:00:00Z',
    });

    const wsState = useTaskStore.getState().tasksByWorkspace['ws-1'];
    expect(wsState.activeTaskProgress['task-1'].lastToolUse).toEqual({
      tool: 'Edit',
      input: { file_path: 'src/main.ts' },
    });
  });

  it('handles task_tool_result events', () => {
    renderHook(() => useTaskWebSocket());

    capturedHandlers['task_tool_result']!({
      type: 'task_tool_result',
      taskId: 'task-1',
      workspaceId: 'ws-1',
      tool: 'Read',
      result: 'file contents...',
      timestamp: '2026-02-22T00:00:00Z',
    });

    const wsState = useTaskStore.getState().tasksByWorkspace['ws-1'];
    expect(wsState.activeTaskProgress['task-1'].lastToolResult).toEqual({
      tool: 'Read',
      result: 'file contents...',
    });
  });

  it('handles task_complete events by clearing progress', () => {
    renderHook(() => useTaskWebSocket());

    // First add some progress
    capturedHandlers['task_progress']!({
      type: 'task_progress',
      taskId: 'task-1',
      workspaceId: 'ws-1',
      text: 'Working...',
      timestamp: '2026-02-22T00:00:00Z',
    });

    // Verify progress exists
    let wsState = useTaskStore.getState().tasksByWorkspace['ws-1'];
    expect(wsState.activeTaskProgress['task-1']).toBeDefined();

    // Now complete
    capturedHandlers['task_complete']!({
      type: 'task_complete',
      taskId: 'task-1',
      workspaceId: 'ws-1',
      status: 'completed',
      timestamp: '2026-02-22T00:00:00Z',
    });

    wsState = useTaskStore.getState().tasksByWorkspace['ws-1'];
    expect(wsState.activeTaskProgress['task-1']).toBeUndefined();
  });

  it('ignores task_progress with missing taskId', () => {
    renderHook(() => useTaskWebSocket());

    capturedHandlers['task_progress']!({
      type: 'task_progress',
      workspaceId: 'ws-1',
      text: 'hello',
    });

    expect(useTaskStore.getState().tasksByWorkspace).toEqual({});
  });

  it('ignores task_progress with missing workspaceId', () => {
    renderHook(() => useTaskWebSocket());

    capturedHandlers['task_progress']!({
      type: 'task_progress',
      taskId: 'task-1',
      text: 'hello',
    });

    expect(useTaskStore.getState().tasksByWorkspace).toEqual({});
  });
});
