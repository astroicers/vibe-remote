// Task Manager — CRUD operations for tasks stored in SQLite

import { getDb, generateId } from '../db/index.js';

export type TaskStatus = 'pending' | 'queued' | 'running' | 'awaiting_review' | 'approved' | 'committed' | 'completed' | 'failed' | 'cancelled';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Task {
  id: string;
  workspace_id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  progress: number | null;
  branch: string | null;
  depends_on: string | null;  // JSON array of task IDs
  context_files: string | null;  // JSON array of file paths
  result: string | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
}

export interface CreateTaskInput {
  workspaceId: string;
  title: string;
  description: string;
  priority?: TaskPriority;
  contextFiles?: string[];
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  result?: string;
  error?: string;
  branch?: string;
}

export class TaskManager {
  createTask(input: CreateTaskInput): Task {
    const db = getDb();
    const id = generateId('task');
    const contextFiles = input.contextFiles ? JSON.stringify(input.contextFiles) : null;

    db.prepare(`
      INSERT INTO tasks (id, workspace_id, title, description, status, priority, context_files, updated_at)
      VALUES (?, ?, ?, ?, 'pending', ?, ?, datetime('now'))
    `).run(id, input.workspaceId, input.title, input.description, input.priority ?? 'normal', contextFiles);

    return this.getTask(id)!;
  }

  getTask(id: string): Task | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task | undefined;
    return row ?? null;
  }

  listTasks(workspaceId: string): Task[] {
    const db = getDb();
    return db.prepare(
      `SELECT * FROM tasks WHERE workspace_id = ?
       ORDER BY
         CASE priority
           WHEN 'urgent' THEN 0
           WHEN 'high' THEN 1
           WHEN 'normal' THEN 2
           WHEN 'low' THEN 3
         END ASC,
         created_at DESC`
    ).all(workspaceId) as Task[];
  }

  updateTask(id: string, updates: UpdateTaskInput): Task | null {
    const db = getDb();
    const fields: string[] = [];
    const values: unknown[] = [];

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) return this.getTask(id);

    // Always update updated_at
    fields.push("updated_at = datetime('now')");

    // If status is changing to running, set started_at
    if (updates.status === 'running') {
      fields.push("started_at = datetime('now')");
    }

    // If status is changing to completed/failed/cancelled, set completed_at
    if (updates.status === 'completed' || updates.status === 'failed' || updates.status === 'cancelled') {
      fields.push("completed_at = datetime('now')");
    }

    values.push(id);

    db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.getTask(id);
  }

  deleteTask(id: string): boolean {
    const db = getDb();
    const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    return result.changes > 0;
  }
}
