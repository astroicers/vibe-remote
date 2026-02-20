// Tasks Store — Per-workspace partitioned task state

import { create } from 'zustand';
import { tasks, type Task, type TaskPriority } from '../services/api';

interface WorkspaceTaskState {
  tasks: Task[];
}

function createDefaultWorkspaceTaskState(): WorkspaceTaskState {
  return {
    tasks: [],
  };
}

interface TaskState {
  tasksByWorkspace: Record<string, WorkspaceTaskState>;
  isLoading: boolean;
  error: string | null;

  getTaskState: (workspaceId: string) => WorkspaceTaskState;
  loadTasks: (workspaceId: string) => Promise<void>;
  createTask: (workspaceId: string, title: string, description: string, priority?: TaskPriority, contextFiles?: string[]) => Promise<Task>;
  updateTask: (workspaceId: string, taskId: string, updates: Partial<{ title: string; description: string; priority: TaskPriority }>) => Promise<void>;
  deleteTask: (workspaceId: string, taskId: string) => Promise<void>;
  runTask: (workspaceId: string, taskId: string) => Promise<void>;
  cancelTask: (workspaceId: string, taskId: string) => Promise<void>;
  handleTaskStatusUpdate: (task: Task) => void;
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
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load tasks',
      });
    }
  },

  createTask: async (workspaceId: string, title: string, description: string, priority?: TaskPriority, contextFiles?: string[]) => {
    set({ isLoading: true, error: null });
    try {
      const task = await tasks.create({ workspaceId, title, description, priority, contextFiles });
      set((state) => ({
        ...updateWorkspaceTasks(state, workspaceId, (ws) => ({
          tasks: [task, ...ws.tasks],
        })),
        isLoading: false,
      }));
      return task;
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to create task',
      });
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
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to delete task',
      });
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
      set({
        error: error instanceof Error ? error.message : 'Failed to run task',
      });
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
      set({
        error: error instanceof Error ? error.message : 'Failed to cancel task',
      });
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

  clearError: () => set({ error: null }),
}));
