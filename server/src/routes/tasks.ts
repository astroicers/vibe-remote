// Task API Routes

import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../auth/middleware.js';
import { TaskManager, TaskQueue, type Task } from '../tasks/index.js';
import { runTask } from '../tasks/runner.js';
import { broadcastTaskStatus } from '../ws/index.js';

const router = Router();

// Apply auth to all task routes
router.use(authMiddleware);

// Shared instances
const taskManager = new TaskManager();
const taskQueue = new TaskQueue(taskManager);

// Replace stub with real AI runner
taskQueue.setRunner(runTask);

// Broadcast task status changes via WebSocket
taskQueue.onTaskStatusChange((task: Task) => {
  broadcastTaskStatus(task as unknown as Record<string, unknown>);
});

// List tasks (requires workspaceId query param)
router.get('/', (req, res) => {
  const workspaceId = req.query.workspaceId as string | undefined;
  if (!workspaceId) {
    res.status(400).json({
      error: 'workspaceId is required',
      code: 'MISSING_WORKSPACE_ID',
    });
    return;
  }

  const tasks = taskManager.listTasks(workspaceId);
  res.json(tasks);
});

// Get single task
router.get('/:id', (req, res) => {
  const task = taskManager.getTask(req.params.id);
  if (!task) {
    res.status(404).json({
      error: 'Task not found',
      code: 'NOT_FOUND',
    });
    return;
  }
  res.json(task);
});

// Create task
const createTaskSchema = z.object({
  workspaceId: z.string().min(1, 'workspaceId is required'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  contextFiles: z.array(z.string()).optional(),
});

router.post('/', (req, res) => {
  const parsed = createTaskSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid request: workspaceId, title, and description are required',
      code: 'VALIDATION_ERROR',
      details: parsed.error.issues,
    });
    return;
  }

  const task = taskManager.createTask(parsed.data);
  res.status(201).json(task);
});

// Update task
const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  status: z.enum(['pending', 'queued', 'running', 'awaiting_review', 'approved', 'committed', 'completed', 'failed', 'cancelled']).optional(),
});

router.patch('/:id', (req, res) => {
  const parsed = updateTaskSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid request',
      code: 'VALIDATION_ERROR',
      details: parsed.error.issues,
    });
    return;
  }

  const { title, description, priority, status } = parsed.data;

  if (!title && !description && !priority && !status) {
    res.status(400).json({
      error: 'At least one field must be provided',
      code: 'VALIDATION_ERROR',
    });
    return;
  }

  const task = taskManager.updateTask(req.params.id, parsed.data);

  if (!task) {
    res.status(404).json({
      error: 'Task not found',
      code: 'NOT_FOUND',
    });
    return;
  }

  // Broadcast status change if status was updated
  if (status) {
    broadcastTaskStatus(task as unknown as Record<string, unknown>);
  }

  res.json(task);
});

// Delete task
router.delete('/:id', (req, res) => {
  const task = taskManager.getTask(req.params.id);
  if (!task) {
    res.status(404).json({
      error: 'Task not found',
      code: 'NOT_FOUND',
    });
    return;
  }

  // Only allow deleting completed, failed, or cancelled tasks
  if (task.status === 'running') {
    res.status(400).json({
      error: 'Cannot delete a running task. Cancel it first.',
      code: 'TASK_RUNNING',
    });
    return;
  }

  const deleted = taskManager.deleteTask(req.params.id);
  if (!deleted) {
    res.status(404).json({
      error: 'Task not found',
      code: 'NOT_FOUND',
    });
    return;
  }

  res.json({ success: true });
});

// Run task (enqueue for execution)
router.post('/:id/run', (req, res) => {
  const task = taskManager.getTask(req.params.id);
  if (!task) {
    res.status(404).json({
      error: 'Task not found',
      code: 'NOT_FOUND',
    });
    return;
  }

  if (task.status !== 'pending') {
    res.status(400).json({
      error: `Cannot run task with status "${task.status}". Only pending tasks can be run.`,
      code: 'INVALID_STATUS',
    });
    return;
  }

  taskQueue.enqueue(task.id);
  res.json(task);
});

// Cancel task
router.post('/:id/cancel', async (req, res) => {
  const task = taskManager.getTask(req.params.id);
  if (!task) {
    res.status(404).json({
      error: 'Task not found',
      code: 'NOT_FOUND',
    });
    return;
  }

  if (task.status !== 'pending' && task.status !== 'running') {
    res.status(400).json({
      error: `Cannot cancel task with status "${task.status}". Only pending or running tasks can be cancelled.`,
      code: 'INVALID_STATUS',
    });
    return;
  }

  const cancelled = await taskQueue.cancel(task.id);
  if (cancelled) {
    res.json(cancelled);
  } else {
    res.status(500).json({
      error: 'Failed to cancel task',
      code: 'CANCEL_FAILED',
    });
  }
});

export default router;
