// KanbanColumn — Renders a column of task cards with a header

import type { Task } from '../../services/api';
import { TaskCard } from './TaskCard';

interface KanbanColumnProps {
  title: string;
  tasks: Task[];
  color: string;
  icon: React.ReactNode;
  onTaskRun?: (taskId: string) => void;
  onTaskCancel?: (taskId: string) => void;
  onTaskDelete?: (taskId: string) => void;
}

export function KanbanColumn({
  title,
  tasks,
  color,
  icon,
  onTaskRun,
  onTaskCancel,
  onTaskDelete,
}: KanbanColumnProps) {
  return (
    <section>
      <h2 className="text-sm font-medium text-text-secondary mb-3 flex items-center gap-2">
        <span className={color}>{icon}</span>
        {title}
        {tasks.length > 0 && (
          <span className="text-xs text-text-muted bg-bg-tertiary px-1.5 py-0.5 rounded-full">
            {tasks.length}
          </span>
        )}
      </h2>
      <div className="space-y-2">
        {tasks.length === 0 ? (
          <div className="bg-bg-secondary rounded-xl p-4 border border-border">
            <p className="text-sm text-text-muted text-center py-2">
              No {title.toLowerCase()} tasks
            </p>
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onRun={onTaskRun}
              onCancel={onTaskCancel}
              onDelete={onTaskDelete}
            />
          ))
        )}
      </div>
    </section>
  );
}
