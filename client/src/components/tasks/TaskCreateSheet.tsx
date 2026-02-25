// TaskCreateSheet — BottomSheet form to create a new task

import { useState } from 'react';
import { BottomSheet } from '../BottomSheet';
import type { TaskPriority, Task, CreateTaskData } from '../../services/api';

interface TaskCreateSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<CreateTaskData, 'workspaceId'>) => void;
  isLoading?: boolean;
  availableTasks?: Task[];
}

export function TaskCreateSheet({ isOpen, onClose, onSubmit, isLoading, availableTasks = [] }: TaskCreateSheetProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [autoBranch, setAutoBranch] = useState(true);
  const [customBranch, setCustomBranch] = useState('');
  const [selectedDeps, setSelectedDeps] = useState<string[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    const data: Omit<CreateTaskData, 'workspaceId'> = {
      title: title.trim(),
      description: description.trim(),
      priority,
      autoBranch,
    };

    if (!autoBranch && customBranch.trim()) {
      data.branch = customBranch.trim();
      data.autoBranch = false;
    }

    if (selectedDeps.length > 0) {
      data.dependsOn = selectedDeps;
    }

    onSubmit(data);
    resetForm();
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPriority('normal');
    setAutoBranch(true);
    setCustomBranch('');
    setSelectedDeps([]);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const toggleDep = (taskId: string) => {
    setSelectedDeps(prev =>
      prev.includes(taskId)
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  // Filter out tasks that can be dependencies (same workspace, not completed terminal states make no sense to block on)
  const depCandidates = availableTasks.filter(
    t => t.status !== 'cancelled' && t.status !== 'failed'
  );

  return (
    <BottomSheet isOpen={isOpen} onClose={handleClose} title="Create Task">
      <form onSubmit={handleSubmit} className="px-4 py-3 space-y-4">
        {/* Title */}
        <div className="space-y-1.5">
          <label htmlFor="task-title" className="text-sm font-medium text-text-secondary">
            Title
          </label>
          <input
            id="task-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to be done?"
            className="input w-full text-sm"
            autoFocus
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label htmlFor="task-description" className="text-sm font-medium text-text-secondary">
            Description
          </label>
          <textarea
            id="task-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the task in detail..."
            className="input w-full text-sm resize-none"
            rows={3}
          />
        </div>

        {/* Priority */}
        <div className="space-y-1.5">
          <label htmlFor="task-priority" className="text-sm font-medium text-text-secondary">
            Priority
          </label>
          <select
            id="task-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
            className="input w-full text-sm appearance-none"
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>

        {/* Branch toggle */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-text-secondary">
              Auto create branch
            </label>
            <button
              type="button"
              role="switch"
              aria-checked={autoBranch}
              onClick={() => setAutoBranch(!autoBranch)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                autoBranch ? 'bg-accent' : 'bg-bg-tertiary'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                  autoBranch ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          {!autoBranch && (
            <input
              type="text"
              value={customBranch}
              onChange={(e) => setCustomBranch(e.target.value)}
              placeholder="Custom branch name (optional)"
              className="input w-full text-sm"
            />
          )}
        </div>

        {/* Dependencies */}
        {depCandidates.length > 0 && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-secondary">
              Depends on
            </label>
            <div className="max-h-32 overflow-y-auto space-y-1 border border-border rounded-lg p-2">
              {depCandidates.map(t => (
                <label key={t.id} className="flex items-center gap-2 py-1 px-1 rounded hover:bg-bg-tertiary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedDeps.includes(t.id)}
                    onChange={() => toggleDep(t.id)}
                    className="rounded border-border text-accent focus:ring-accent"
                  />
                  <span className="text-xs text-text-primary truncate flex-1">{t.title}</span>
                  <span className="text-xs text-text-muted">{t.status}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={!title.trim() || !description.trim() || isLoading}
          className="btn-primary w-full text-sm"
        >
          {isLoading ? 'Creating...' : 'Create Task'}
        </button>
      </form>
    </BottomSheet>
  );
}
