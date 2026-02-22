import { useEffect } from 'react';
import { ws } from '../services/websocket';
import type {
  TaskProgressEvent,
  TaskToolUseEvent,
  TaskToolResultEvent,
  TaskCompleteEvent,
} from '../services/websocket';
import { useTaskStore } from '../stores/tasks';
import { useToastStore } from '../stores/toast';
import type { Task } from '../services/api';

export function useTaskWebSocket(): void {
  useEffect(() => {
    const unsubTaskStatus = ws.on('task_status', (data: Record<string, unknown>) => {
      const task = data.task as Task | undefined;
      if (!task?.id || !task?.workspace_id) return; // defensive guard

      // Update store (upsert)
      useTaskStore.getState().handleTaskStatusUpdate(task);

      // Toast for terminal states
      if (task.status === 'completed') {
        useToastStore.getState().addToast(`Task completed: ${task.title}`, 'success');
      } else if (task.status === 'failed') {
        useToastStore.getState().addToast(`Task failed: ${task.title}`, 'error');
      }
    });

    const unsubProgress = ws.on('task_progress', (data: Record<string, unknown>) => {
      const event = data as unknown as TaskProgressEvent;
      if (!event.taskId || !event.workspaceId) return;

      useTaskStore.getState().handleTaskProgress(
        event.taskId,
        event.workspaceId,
        event.text
      );
    });

    const unsubToolUse = ws.on('task_tool_use', (data: Record<string, unknown>) => {
      const event = data as unknown as TaskToolUseEvent;
      if (!event.taskId || !event.workspaceId) return;

      useTaskStore.getState().handleTaskToolUse(
        event.taskId,
        event.workspaceId,
        event.tool,
        event.input
      );
    });

    const unsubToolResult = ws.on('task_tool_result', (data: Record<string, unknown>) => {
      const event = data as unknown as TaskToolResultEvent;
      if (!event.taskId || !event.workspaceId) return;

      useTaskStore.getState().handleTaskToolResult(
        event.taskId,
        event.workspaceId,
        event.tool,
        event.result
      );
    });

    const unsubComplete = ws.on('task_complete', (data: Record<string, unknown>) => {
      const event = data as unknown as TaskCompleteEvent;
      if (!event.taskId || !event.workspaceId) return;

      useTaskStore.getState().handleTaskComplete(
        event.taskId,
        event.workspaceId
      );
    });

    return () => {
      unsubTaskStatus();
      unsubProgress();
      unsubToolUse();
      unsubToolResult();
      unsubComplete();
    };
  }, []);
}
