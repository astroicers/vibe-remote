import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskCard } from './TaskCard';
import type { Task } from '../../services/api';

function createMockTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task_1',
    workspace_id: 'ws_1',
    title: 'Fix the login bug',
    description: 'The login form is not validating email addresses correctly.',
    status: 'pending',
    priority: 'normal',
    progress: null,
    branch: null,
    depends_on: null,
    dependency_status: 'ready',
    context_files: null,
    result: null,
    error: null,
    created_at: new Date().toISOString(),
    started_at: null,
    completed_at: null,
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('TaskCard', () => {
  it('should render task title and description', () => {
    const task = createMockTask();
    render(<TaskCard task={task} />);

    expect(screen.getByText('Fix the login bug')).toBeInTheDocument();
    expect(screen.getByText(/login form is not validating/)).toBeInTheDocument();
  });

  it('should display pending status badge', () => {
    const task = createMockTask({ status: 'pending' });
    render(<TaskCard task={task} />);

    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('should display running status badge', () => {
    const task = createMockTask({ status: 'running' });
    render(<TaskCard task={task} />);

    expect(screen.getByText('Running')).toBeInTheDocument();
  });

  it('should display completed status badge', () => {
    const task = createMockTask({ status: 'completed', result: 'All done' });
    render(<TaskCard task={task} />);

    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('All done')).toBeInTheDocument();
  });

  it('should display failed status with error message', () => {
    const task = createMockTask({ status: 'failed', error: 'Something went wrong' });
    render(<TaskCard task={task} />);

    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('should display priority label', () => {
    const task = createMockTask({ priority: 'urgent' });
    render(<TaskCard task={task} />);

    expect(screen.getByText('Urgent')).toBeInTheDocument();
  });

  it('should show Run button for pending tasks', () => {
    const task = createMockTask({ status: 'pending' });
    const onRun = vi.fn();
    render(<TaskCard task={task} onRun={onRun} />);

    expect(screen.getByText('Run')).toBeInTheDocument();
  });

  it('should show Cancel button for running tasks', () => {
    const task = createMockTask({ status: 'running' });
    const onCancel = vi.fn();
    render(<TaskCard task={task} onCancel={onCancel} />);

    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('should show Delete button for completed tasks', () => {
    const task = createMockTask({ status: 'completed' });
    const onDelete = vi.fn();
    render(<TaskCard task={task} onDelete={onDelete} />);

    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('should not show Delete button for running tasks', () => {
    const task = createMockTask({ status: 'running' });
    const onDelete = vi.fn();
    render(<TaskCard task={task} onDelete={onDelete} />);

    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });

  it('should call onRun when Run button is clicked', async () => {
    const user = userEvent.setup();
    const task = createMockTask({ status: 'pending' });
    const onRun = vi.fn();
    render(<TaskCard task={task} onRun={onRun} />);

    await user.click(screen.getByText('Run'));
    expect(onRun).toHaveBeenCalledWith('task_1');
  });

  it('should call onCancel when Cancel button is clicked', async () => {
    const user = userEvent.setup();
    const task = createMockTask({ status: 'running' });
    const onCancel = vi.fn();
    render(<TaskCard task={task} onCancel={onCancel} />);

    await user.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledWith('task_1');
  });

  it('should call onDelete when Delete button is clicked', async () => {
    const user = userEvent.setup();
    const task = createMockTask({ status: 'failed' });
    const onDelete = vi.fn();
    render(<TaskCard task={task} onDelete={onDelete} />);

    await user.click(screen.getByText('Delete'));
    expect(onDelete).toHaveBeenCalledWith('task_1');
  });
});
