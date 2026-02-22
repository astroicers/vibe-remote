import { useEffect } from 'react';
import { ws } from '../services/websocket';
import { useTaskStore } from '../stores/tasks';
import { useToastStore } from '../stores/toast';
import type { Task } from '../services/api';

export function useTaskWebSocket(): void {
  useEffect(() => {
    const unsubscribe = ws.on('task_status', (data: Record<string, unknown>) => {
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

    return unsubscribe;
  }, []);
}
