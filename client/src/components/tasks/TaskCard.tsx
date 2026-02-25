// TaskCard — Displays a single task with status badge, priority, branch, dependency status, and action buttons

import type { Task, TaskStatus, TaskPriority, DependencyStatus } from '../../services/api';

interface TaskCardProps {
  task: Task;
  onRun?: (taskId: string) => void;
  onCancel?: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
}

const statusConfig: Record<TaskStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: 'Pending', color: 'text-warning', bgColor: 'bg-warning/15' },
  queued: { label: 'Queued', color: 'text-warning', bgColor: 'bg-warning/15' },
  running: { label: 'Running', color: 'text-accent', bgColor: 'bg-accent/15' },
  awaiting_review: { label: 'Review', color: 'text-accent-hover', bgColor: 'bg-accent-hover/15' },
  approved: { label: 'Approved', color: 'text-success', bgColor: 'bg-success/15' },
  committed: { label: 'Committed', color: 'text-success', bgColor: 'bg-success/15' },
  completed: { label: 'Completed', color: 'text-success', bgColor: 'bg-success/15' },
  failed: { label: 'Failed', color: 'text-danger', bgColor: 'bg-danger/15' },
  cancelled: { label: 'Cancelled', color: 'text-text-muted', bgColor: 'bg-bg-tertiary' },
};

const priorityConfig: Record<TaskPriority, { label: string; color: string }> = {
  urgent: { label: 'Urgent', color: 'text-danger' },
  high: { label: 'High', color: 'text-warning' },
  normal: { label: 'Normal', color: 'text-text-secondary' },
  low: { label: 'Low', color: 'text-text-muted' },
};

const depStatusConfig: Record<DependencyStatus, { label: string; color: string; bgColor: string }> = {
  ready: { label: 'Ready', color: 'text-success', bgColor: 'bg-success/15' },
  waiting: { label: 'Waiting', color: 'text-warning', bgColor: 'bg-warning/15' },
  blocked: { label: 'Blocked', color: 'text-danger', bgColor: 'bg-danger/15' },
};

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${diffDays}d ago`;
}

export function TaskCard({ task, onRun, onCancel, onDelete }: TaskCardProps) {
  const status = statusConfig[task.status] || statusConfig.pending;
  const priority = priorityConfig[task.priority] || priorityConfig.normal;

  const canRun = task.status === 'pending' && task.dependency_status === 'ready';
  const canCancel = task.status === 'pending' || task.status === 'running';
  const canDelete = task.status !== 'running';
  const isRunning = task.status === 'running';

  const hasDeps = task.depends_on !== null;
  const depStatus = task.dependency_status && task.dependency_status !== 'ready' && hasDeps
    ? depStatusConfig[task.dependency_status]
    : null;

  return (
    <div className="bg-bg-surface border border-border rounded-lg p-3 space-y-2">
      {/* Header: title + status badge */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-text-primary leading-tight flex-1 min-w-0 truncate">
          {task.title}
        </h3>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${status.color} ${status.bgColor} flex-shrink-0`}
        >
          {isRunning && (
            <span className="w-1.5 h-1.5 bg-accent rounded-full mr-1.5 animate-pulse" />
          )}
          {status.label}
        </span>
      </div>

      {/* Description */}
      {task.description && (
        <p className="text-xs text-text-secondary line-clamp-2">{task.description}</p>
      )}

      {/* Branch badge */}
      {task.branch && (
        <div className="flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 text-text-muted">
            <path fillRule="evenodd" d="M9.487 4.63a1.5 1.5 0 1 1 .927-1.406 2.5 2.5 0 0 1 .214 3.59L8.053 9.75H14.5a.75.75 0 0 1 0 1.5H8.053l2.575 2.936a2.5 2.5 0 0 1-.214 3.59 1.5 1.5 0 1 1-.927-1.406A1 1 0 0 0 9.4 15.5l-3.4-3.879L2.6 15.5a1 1 0 0 0-.087.87 1.5 1.5 0 1 1-.927 1.406 2.5 2.5 0 0 1 .214-3.59L4.375 11.25H1.5a.75.75 0 0 1 0-1.5h2.875L1.8 6.814a2.5 2.5 0 0 1 .214-3.59A1.5 1.5 0 1 1 2.94 4.63 1 1 0 0 0 2.6 5.5L6 9.379 9.4 5.5a1 1 0 0 0 .087-.87Z" clipRule="evenodd" />
          </svg>
          <span className="text-xs text-text-muted font-mono truncate">{task.branch}</span>
        </div>
      )}

      {/* Dependency status badge */}
      {depStatus && (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${depStatus.color} ${depStatus.bgColor}`}>
          {depStatus.label}
        </span>
      )}

      {/* Meta row: priority + time */}
      <div className="flex items-center justify-between text-xs">
        <span className={`${priority.color} font-medium`}>{priority.label}</span>
        <span className="text-text-muted">{formatRelativeTime(task.created_at)}</span>
      </div>

      {/* Error message if failed */}
      {task.status === 'failed' && task.error && (
        <p className="text-xs text-danger bg-danger/10 rounded px-2 py-1 line-clamp-2">
          {task.error}
        </p>
      )}

      {/* Result message if completed */}
      {task.status === 'completed' && task.result && (
        <p className="text-xs text-success bg-success/10 rounded px-2 py-1 line-clamp-2">
          {task.result}
        </p>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-1">
        {canRun && onRun && (
          <button
            onClick={() => onRun(task.id)}
            className="flex-1 text-xs font-medium py-2.5 px-3 min-h-[40px] rounded-md bg-accent/15 text-accent hover:bg-accent/25 transition-colors"
          >
            Run
          </button>
        )}
        {task.status === 'pending' && task.dependency_status !== 'ready' && (
          <span className="flex-1 text-xs font-medium py-2.5 px-3 min-h-[40px] rounded-md bg-bg-tertiary text-text-muted text-center">
            {task.dependency_status === 'waiting' ? 'Waiting deps...' : 'Deps blocked'}
          </span>
        )}
        {canCancel && onCancel && (
          <button
            onClick={() => onCancel(task.id)}
            className="flex-1 text-xs font-medium py-2.5 px-3 min-h-[40px] rounded-md bg-warning/15 text-warning hover:bg-warning/25 transition-colors"
          >
            Cancel
          </button>
        )}
        {canDelete && onDelete && (
          <button
            onClick={() => onDelete(task.id)}
            className="text-xs font-medium py-2.5 px-3 min-h-[40px] rounded-md bg-danger/15 text-danger hover:bg-danger/25 transition-colors"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
