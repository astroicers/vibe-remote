// Tasks Page - Kanban-style task management

import { useEffect, useState } from 'react';
import { AppLayout } from '../components/AppLayout';
import { KanbanColumn } from '../components/tasks/KanbanColumn';
import { TaskCreateSheet } from '../components/tasks/TaskCreateSheet';
import { useTaskStore } from '../stores/tasks';
import { useWorkspaceStore } from '../stores/workspace';
import type { Task, TaskPriority } from '../services/api';

// Icons
function ClockIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z" clipRule="evenodd" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 animate-spin">
      <path fillRule="evenodd" d="M4.755 10.059a7.5 7.5 0 0 1 12.548-3.364l1.903 1.903h-3.183a.75.75 0 1 0 0 1.5h4.992a.75.75 0 0 0 .75-.75V4.356a.75.75 0 0 0-1.5 0v3.18l-1.9-1.9A9 9 0 0 0 3.306 9.67a.75.75 0 1 0 1.45.388Zm15.408 3.352a.75.75 0 0 0-.919.53 7.5 7.5 0 0 1-12.548 3.364l-1.902-1.903h3.183a.75.75 0 0 0 0-1.5H2.984a.75.75 0 0 0-.75.75v4.992a.75.75 0 0 0 1.5 0v-3.18l1.9 1.9a9 9 0 0 0 15.059-4.035.75.75 0 0 0-.53-.918Z" clipRule="evenodd" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
    </svg>
  );
}

function XCircleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-1.72 6.97a.75.75 0 0 0-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 1 0 1.06 1.06L12 13.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L13.06 12l1.72-1.72a.75.75 0 1 0-1.06-1.06L12 10.94l-1.72-1.72Z" clipRule="evenodd" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
      <path fillRule="evenodd" d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
    </svg>
  );
}

export function TasksPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const selectedWorkspaceId = useWorkspaceStore((s) => s.selectedWorkspaceId);
  const { getTaskState, loadTasks, createTask, runTask, cancelTask, deleteTask, isLoading, error, clearError } = useTaskStore();

  const workspaceId = selectedWorkspaceId || '';
  const { tasks: taskList } = getTaskState(workspaceId);

  // Load tasks on mount and when workspace changes
  useEffect(() => {
    if (workspaceId) {
      loadTasks(workspaceId);
    }
  }, [workspaceId, loadTasks]);

  // Partition tasks into columns
  const pendingTasks = taskList.filter((t: Task) => t.status === 'pending' || t.status === 'queued');
  const runningTasks = taskList.filter((t: Task) => t.status === 'running');
  const completedTasks = taskList.filter((t: Task) => t.status === 'completed' || t.status === 'approved' || t.status === 'committed');
  const failedTasks = taskList.filter((t: Task) => t.status === 'failed' || t.status === 'cancelled');

  const handleCreate = async (title: string, description: string, priority: TaskPriority) => {
    if (!workspaceId) return;
    try {
      await createTask(workspaceId, title, description, priority);
      setIsCreateOpen(false);
    } catch {
      // Error is in store
    }
  };

  const handleRun = async (taskId: string) => {
    if (!workspaceId) return;
    try {
      await runTask(workspaceId, taskId);
    } catch {
      // Error is in store
    }
  };

  const handleCancel = async (taskId: string) => {
    if (!workspaceId) return;
    try {
      await cancelTask(workspaceId, taskId);
    } catch {
      // Error is in store
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!workspaceId) return;
    try {
      await deleteTask(workspaceId, taskId);
    } catch {
      // Error is in store
    }
  };

  return (
    <AppLayout>
      {/* Header */}
      <header className="flex items-center justify-between px-4 h-14 border-b border-border bg-bg-secondary flex-shrink-0">
        <h1 className="text-base font-medium text-text-primary">Tasks</h1>
        {taskList.length > 0 && (
          <span className="text-xs text-text-muted">
            {taskList.length} total
          </span>
        )}
      </header>

      {/* Error toast */}
      {error && (
        <div className="mx-4 mt-2 p-3 bg-danger/15 text-danger text-sm rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button onClick={clearError} className="text-danger hover:text-danger/80 ml-2">
            <XCircleIcon />
          </button>
        </div>
      )}

      {/* No workspace selected */}
      {!workspaceId ? (
        <main className="flex-1 flex items-center justify-center px-4">
          <p className="text-sm text-text-muted text-center">
            Select a workspace to view tasks
          </p>
        </main>
      ) : (
        <>
          {/* Kanban Board */}
          <main className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
            <KanbanColumn
              title="Pending"
              tasks={pendingTasks}
              color="text-warning"
              icon={<ClockIcon />}
              onTaskRun={handleRun}
              onTaskCancel={handleCancel}
              onTaskDelete={handleDelete}
            />
            <KanbanColumn
              title="Running"
              tasks={runningTasks}
              color="text-accent"
              icon={<SpinnerIcon />}
              onTaskCancel={handleCancel}
            />
            <KanbanColumn
              title="Completed"
              tasks={completedTasks}
              color="text-success"
              icon={<CheckIcon />}
              onTaskDelete={handleDelete}
            />
            <KanbanColumn
              title="Failed"
              tasks={failedTasks}
              color="text-danger"
              icon={<XCircleIcon />}
              onTaskDelete={handleDelete}
            />
          </main>

          {/* FAB - Floating Action Button */}
          <button
            onClick={() => setIsCreateOpen(true)}
            className="fixed bottom-20 right-4 z-30 w-14 h-14 rounded-full bg-accent text-white shadow-lg hover:bg-accent-hover active:scale-95 transition-all flex items-center justify-center"
            aria-label="Create new task"
          >
            <PlusIcon />
          </button>

          {/* Create Task Sheet */}
          <TaskCreateSheet
            isOpen={isCreateOpen}
            onClose={() => setIsCreateOpen(false)}
            onSubmit={handleCreate}
            isLoading={isLoading}
          />
        </>
      )}
    </AppLayout>
  );
}
