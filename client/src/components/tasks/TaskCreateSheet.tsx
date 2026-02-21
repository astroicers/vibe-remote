// TaskCreateSheet — BottomSheet form to create a new task

import { useState } from 'react';
import { BottomSheet } from '../BottomSheet';
import type { TaskPriority } from '../../services/api';

interface TaskCreateSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (title: string, description: string, priority: TaskPriority) => void;
  isLoading?: boolean;
}

export function TaskCreateSheet({ isOpen, onClose, onSubmit, isLoading }: TaskCreateSheetProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('normal');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    onSubmit(title.trim(), description.trim(), priority);
    // Reset form
    setTitle('');
    setDescription('');
    setPriority('normal');
  };

  const handleClose = () => {
    setTitle('');
    setDescription('');
    setPriority('normal');
    onClose();
  };

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
