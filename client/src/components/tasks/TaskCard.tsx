// TaskCard — Displays a single task with status badge, priority, and action buttons

import type { Task, TaskStatus, TaskPriority } from '../../services/api';

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

  const canRun = task.status === 'pending';
  const canCancel = task.status === 'pending' || task.status === 'running';
  const canDelete = task.status !== 'running';
  const isRunning = task.status === 'running';

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
            className="flex-1 text-xs font-medium py-1.5 px-3 rounded-md bg-accent/15 text-accent hover:bg-accent/25 transition-colors"
          >
            Run
          </button>
        )}
        {canCancel && onCancel && (
          <button
            onClick={() => onCancel(task.id)}
            className="flex-1 text-xs font-medium py-1.5 px-3 rounded-md bg-warning/15 text-warning hover:bg-warning/25 transition-colors"
          >
            Cancel
          </button>
        )}
        {canDelete && onDelete && (
          <button
            onClick={() => onDelete(task.id)}
            className="text-xs font-medium py-1.5 px-3 rounded-md bg-danger/15 text-danger hover:bg-danger/25 transition-colors"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
