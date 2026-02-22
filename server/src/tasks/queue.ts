// Task Queue — in-memory queue for task processing (Phase 1 MVP, Phase 2 will use BullMQ + Redis)

import { TaskManager, type Task } from './manager.js';
import { getDb } from '../db/index.js';

type TaskRunnerFn = (task: Task) => Promise<{ result?: string; error?: string }>;

export class TaskQueue {
  private manager: TaskManager;
  private runner: TaskRunnerFn | null = null;
  private isProcessing = false;
  private currentTaskId: string | null = null;
  private onStatusChange: ((task: Task) => void) | null = null;

  constructor(manager: TaskManager) {
    this.manager = manager;
  }

  setRunner(runner: TaskRunnerFn): void {
    this.runner = runner;
  }

  onTaskStatusChange(callback: (task: Task) => void): void {
    this.onStatusChange = callback;
  }

  async enqueue(_taskId: string): Promise<void> {
    // Task is already in DB with 'pending' status
    // _taskId is the task that was just created, but processNext picks the highest priority pending task
    this.processNext();
  }

  async cancel(taskId: string): Promise<Task | null> {
    const task = this.manager.getTask(taskId);
    if (!task) return null;

    if (task.status === 'pending') {
      const updated = this.manager.updateTask(taskId, { status: 'cancelled' });
      if (updated) this.onStatusChange?.(updated);
      return updated;
    }

    if (task.status === 'running' && this.currentTaskId === taskId) {
      // Mark as cancelled — runner should check this
      const updated = this.manager.updateTask(taskId, { status: 'cancelled' });
      this.currentTaskId = null;
      this.isProcessing = false;
      if (updated) this.onStatusChange?.(updated);
      this.processNext();
      return updated;
    }

    return task;
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing || !this.runner) return;

    // Find next pending task whose dependencies are all met
    const db = getDb();
    const pendingTasks = db.prepare(
      `SELECT * FROM tasks WHERE status = 'pending'
       ORDER BY
         CASE priority
           WHEN 'urgent' THEN 0
           WHEN 'high' THEN 1
           WHEN 'normal' THEN 2
           WHEN 'low' THEN 3
         END ASC,
         created_at ASC`
    ).all() as Task[];

    const next = pendingTasks.find(task =>
      this.manager.getDependencyStatus(task) === 'ready'
    );

    if (!next) return;

    this.isProcessing = true;
    this.currentTaskId = next.id;

    // Mark as running
    const running = this.manager.updateTask(next.id, { status: 'running' });
    if (running) this.onStatusChange?.(running);

    try {
      const result = await this.runner(next);

      // Check if cancelled during execution
      const current = this.manager.getTask(next.id);
      if (current?.status === 'cancelled') {
        this.isProcessing = false;
        this.currentTaskId = null;
        this.processNext();
        return;
      }

      if (result.error) {
        const failed = this.manager.updateTask(next.id, { status: 'failed', error: result.error });
        if (failed) this.onStatusChange?.(failed);
      } else {
        const completed = this.manager.updateTask(next.id, { status: 'completed', result: result.result || 'Task completed' });
        if (completed) this.onStatusChange?.(completed);
      }
    } catch (err) {
      const failed = this.manager.updateTask(next.id, {
        status: 'failed',
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      if (failed) this.onStatusChange?.(failed);
    } finally {
      this.isProcessing = false;
      this.currentTaskId = null;
      // Process next — also picks up downstream tasks whose dependencies just completed
      this.processNext();
    }
  }
}
