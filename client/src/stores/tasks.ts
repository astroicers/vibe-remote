// Tasks Store — Per-workspace partitioned task state

import { create } from 'zustand';
import { tasks, type Task, type TaskPriority, type CreateTaskData } from '../services/api';
import { useToastStore } from './toast';

const MAX_PROGRESS_CHUNKS = 50;

export interface TaskProgress {
  taskId: string;
  chunks: string[];
  currentText: string;
  lastToolUse: { tool: string; input: unknown } | null;
  lastToolResult: { tool: string; result: unknown } | null;
}

interface WorkspaceTaskState {
  tasks: Task[];
  activeTaskProgress: Record<string, TaskProgress>;
}

function createDefaultWorkspaceTaskState(): WorkspaceTaskState {
  return {
    tasks: [],
    activeTaskProgress: {},
  };
}

interface TaskState {
  tasksByWorkspace: Record<string, WorkspaceTaskState>;
  isLoading: boolean;
  error: string | null;

  getTaskState: (workspaceId: string) => WorkspaceTaskState;
  loadTasks: (workspaceId: string) => Promise<void>;
  createTask: (data: CreateTaskData) => Promise<Task>;
  updateTask: (workspaceId: string, taskId: string, updates: Partial<{ title: string; description: string; priority: TaskPriority }>) => Promise<void>;
  deleteTask: (workspaceId: string, taskId: string) => Promise<void>;
  runTask: (workspaceId: string, taskId: string) => Promise<void>;
  cancelTask: (workspaceId: string, taskId: string) => Promise<void>;
  handleTaskStatusUpdate: (task: Task) => void;
  handleTaskProgress: (taskId: string, workspaceId: string, text: string) => void;
  handleTaskToolUse: (taskId: string, workspaceId: string, tool: string, input: unknown) => void;
  handleTaskToolResult: (taskId: string, workspaceId: string, tool: string, result: unknown) => void;
  handleTaskComplete: (taskId: string, workspaceId: string, status: string, result?: string, error?: string, _modifiedFiles?: string[]) => void;
  clearError: () => void;
}

function updateWorkspaceTasks(
  state: TaskState,
  workspaceId: string,
  updater: (taskState: WorkspaceTaskState) => Partial<WorkspaceTaskState>
): Partial<TaskState> {
  const current = state.tasksByWorkspace[workspaceId] || createDefaultWorkspaceTaskState();
  return {
    tasksByWorkspace: {
      ...state.tasksByWorkspace,
      [workspaceId]: { ...current, ...updater(current) },
    },
  };
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasksByWorkspace: {},
  isLoading: false,
  error: null,

  getTaskState: (workspaceId: string) => {
    return get().tasksByWorkspace[workspaceId] || createDefaultWorkspaceTaskState();
  },

  loadTasks: async (workspaceId: string) => {
    set({ isLoading: true, error: null });
    try {
      const taskList = await tasks.list(workspaceId);
      set((state) => ({
        ...updateWorkspaceTasks(state, workspaceId, () => ({ tasks: taskList })),
        isLoading: false,
      }));
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to load tasks';
      set({ isLoading: false, error: msg });
      useToastStore.getState().addToast(msg, 'error');
    }
  },

  createTask: async (data: CreateTaskData) => {
    set({ isLoading: true, error: null });
    try {
      const task = await tasks.create(data);
      const workspaceId = data.workspaceId;
      set((state) => ({
        ...updateWorkspaceTasks(state, workspaceId, (ws) => ({
          tasks: [task, ...ws.tasks],
        })),
        isLoading: false,
      }));
      return task;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to create task';
      set({ isLoading: false, error: msg });
      useToastStore.getState().addToast(msg, 'error');
      throw error;
    }
  },

  updateTask: async (workspaceId: string, taskId: string, updates: Partial<{ title: string; description: string; priority: TaskPriority }>) => {
    set({ isLoading: true, error: null });
    try {
      const updated = await tasks.update(taskId, updates);
      set((state) => ({
        ...updateWorkspaceTasks(state, workspaceId, (ws) => ({
          tasks: ws.tasks.map((t) => (t.id === taskId ? updated : t)),
        })),
        isLoading: false,
      }));
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to update task',
      });
      throw error;
    }
  },

  deleteTask: async (workspaceId: string, taskId: string) => {
    set({ isLoading: true, error: null });
    try {
      await tasks.delete(taskId);
      set((state) => ({
        ...updateWorkspaceTasks(state, workspaceId, (ws) => ({
          tasks: ws.tasks.filter((t) => t.id !== taskId),
        })),
        isLoading: false,
      }));
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to delete task';
      set({ isLoading: false, error: msg });
      useToastStore.getState().addToast(msg, 'error');
      throw error;
    }
  },

  runTask: async (workspaceId: string, taskId: string) => {
    set({ error: null });
    try {
      const updated = await tasks.run(taskId);
      set((state) => ({
        ...updateWorkspaceTasks(state, workspaceId, (ws) => ({
          tasks: ws.tasks.map((t) => (t.id === taskId ? updated : t)),
        })),
      }));
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to run task';
      set({ error: msg });
      useToastStore.getState().addToast(msg, 'error');
      throw error;
    }
  },

  cancelTask: async (workspaceId: string, taskId: string) => {
    set({ error: null });
    try {
      const updated = await tasks.cancel(taskId);
      set((state) => ({
        ...updateWorkspaceTasks(state, workspaceId, (ws) => ({
          tasks: ws.tasks.map((t) => (t.id === taskId ? updated : t)),
        })),
      }));
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to cancel task';
      set({ error: msg });
      useToastStore.getState().addToast(msg, 'error');
      throw error;
    }
  },

  // Called from WebSocket event handler
  handleTaskStatusUpdate: (task: Task) => {
    const workspaceId = task.workspace_id;
    set((state) => {
      const wsState = state.tasksByWorkspace[workspaceId] || createDefaultWorkspaceTaskState();
      const exists = wsState.tasks.some((t) => t.id === task.id);

      return {
        ...updateWorkspaceTasks(state, workspaceId, (ws) => ({
          tasks: exists
            ? ws.tasks.map((t) => (t.id === task.id ? task : t))
            : [task, ...ws.tasks],
        })),
      };
    });
  },

  handleTaskProgress: (taskId: string, workspaceId: string, text: string) => {
    set((state) => {
      const wsState = state.tasksByWorkspace[workspaceId] || createDefaultWorkspaceTaskState();
      const existing = wsState.activeTaskProgress[taskId] || {
        taskId,
        chunks: [],
        currentText: '',
        lastToolUse: null,
        lastToolResult: null,
      };

      const newChunks = [...existing.chunks, text];
      // Keep max MAX_PROGRESS_CHUNKS chunks
      const trimmedChunks = newChunks.length > MAX_PROGRESS_CHUNKS
        ? newChunks.slice(newChunks.length - MAX_PROGRESS_CHUNKS)
        : newChunks;

      return {
        ...updateWorkspaceTasks(state, workspaceId, () => ({
          activeTaskProgress: {
            ...wsState.activeTaskProgress,
            [taskId]: {
              ...existing,
              chunks: trimmedChunks,
              currentText: existing.currentText + text,
            },
          },
        })),
      };
    });
  },

  handleTaskToolUse: (taskId: string, workspaceId: string, tool: string, input: unknown) => {
    set((state) => {
      const wsState = state.tasksByWorkspace[workspaceId] || createDefaultWorkspaceTaskState();
      const existing = wsState.activeTaskProgress[taskId] || {
        taskId,
        chunks: [],
        currentText: '',
        lastToolUse: null,
        lastToolResult: null,
      };

      return {
        ...updateWorkspaceTasks(state, workspaceId, () => ({
          activeTaskProgress: {
            ...wsState.activeTaskProgress,
            [taskId]: {
              ...existing,
              lastToolUse: { tool, input },
            },
          },
        })),
      };
    });
  },

  handleTaskToolResult: (taskId: string, workspaceId: string, tool: string, result: unknown) => {
    set((state) => {
      const wsState = state.tasksByWorkspace[workspaceId] || createDefaultWorkspaceTaskState();
      const existing = wsState.activeTaskProgress[taskId] || {
        taskId,
        chunks: [],
        currentText: '',
        lastToolUse: null,
        lastToolResult: null,
      };

      return {
        ...updateWorkspaceTasks(state, workspaceId, () => ({
          activeTaskProgress: {
            ...wsState.activeTaskProgress,
            [taskId]: {
              ...existing,
              lastToolResult: { tool, result },
            },
          },
        })),
      };
    });
  },

  handleTaskComplete: (taskId: string, workspaceId: string, status: string, result?: string, error?: string, _modifiedFiles?: string[]) => {
    set((state) => {
      const wsState = state.tasksByWorkspace[workspaceId] || createDefaultWorkspaceTaskState();
      const { [taskId]: _removed, ...remaining } = wsState.activeTaskProgress;

      // Update the matching task in the tasks array with status/result/error
      const updatedTasks = wsState.tasks.map((t) => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          status: status as Task['status'],
          result: result ?? t.result,
          error: error ?? t.error,
        };
      });

      return {
        ...updateWorkspaceTasks(state, workspaceId, () => ({
          tasks: updatedTasks,
          activeTaskProgress: remaining,
        })),
      };
    });
  },

  clearError: () => set({ error: null }),
}));
