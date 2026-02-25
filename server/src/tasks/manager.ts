// Task Manager — CRUD operations for tasks stored in SQLite

import { getDb, generateId } from '../db/index.js';

export type TaskStatus = 'pending' | 'queued' | 'running' | 'awaiting_review' | 'approved' | 'committed' | 'completed' | 'failed' | 'cancelled';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';
export type DependencyStatus = 'ready' | 'waiting' | 'blocked';

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

export interface TaskWithDependencyStatus extends Task {
  dependency_status: DependencyStatus;
}

export interface CreateTaskInput {
  workspaceId: string;
  title: string;
  description: string;
  priority?: TaskPriority;
  contextFiles?: string[];
  branch?: string;
  autoBranch?: boolean;  // default true
  dependsOn?: string[];
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

/**
 * Generate a branch name from task ID and title.
 * Format: task/<id_short>-<slug>
 */
function generateBranchName(taskId: string, title: string): string {
  const idShort = taskId.replace('task_', '');
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 40);

  return slug ? `task/${idShort}-${slug}` : `task/${idShort}`;
}

/**
 * Validate a Git branch name (basic check).
 */
function isValidBranchName(name: string): boolean {
  if (name.length === 0 || name.length > 100) return false;
  // Git branch name restrictions
  if (/[\s~^:?*\[\]\\]/.test(name)) return false;
  if (name.startsWith('-') || name.startsWith('.')) return false;
  if (name.endsWith('.') || name.endsWith('.lock') || name.endsWith('/')) return false;
  if (name.includes('..') || name.includes('@{')) return false;
  return true;
}

/**
 * Validate task dependencies.
 * Checks: existence, same workspace, no self-dependency, no circular dependency, max 10.
 */
function validateDependencies(
  workspaceId: string,
  taskId: string | null,
  dependsOn: string[]
): void {
  if (dependsOn.length === 0) return;
  if (dependsOn.length > 10) {
    throw new ValidationError('Maximum 10 dependencies allowed', 'TOO_MANY_DEPENDENCIES');
  }

  // Self-dependency check
  if (taskId && dependsOn.includes(taskId)) {
    throw new ValidationError('Task cannot depend on itself', 'SELF_DEPENDENCY');
  }

  const db = getDb();
  const placeholders = dependsOn.map(() => '?').join(',');
  const depTasks = db.prepare(
    `SELECT id, workspace_id, depends_on FROM tasks WHERE id IN (${placeholders})`
  ).all(...dependsOn) as Array<{ id: string; workspace_id: string; depends_on: string | null }>;

  // Existence check
  const foundIds = new Set(depTasks.map(t => t.id));
  for (const depId of dependsOn) {
    if (!foundIds.has(depId)) {
      throw new ValidationError(`Dependency ${depId} not found`, 'DEPENDENCY_NOT_FOUND');
    }
  }

  // Same workspace check
  for (const dep of depTasks) {
    if (dep.workspace_id !== workspaceId) {
      throw new ValidationError(
        'Dependencies must be in the same workspace',
        'CROSS_WORKSPACE_DEPENDENCY'
      );
    }
  }

  // Circular dependency check (DFS)
  if (taskId) {
    // Build adjacency list from all tasks in the workspace
    const allTasks = db.prepare(
      'SELECT id, depends_on FROM tasks WHERE workspace_id = ?'
    ).all(workspaceId) as Array<{ id: string; depends_on: string | null }>;

    const adjList = new Map<string, string[]>();
    for (const t of allTasks) {
      if (t.depends_on) {
        try {
          adjList.set(t.id, JSON.parse(t.depends_on) as string[]);
        } catch {
          adjList.set(t.id, []);
        }
      }
    }
    // Add the new task's proposed dependencies
    adjList.set(taskId, dependsOn);

    if (hasCycle(adjList, taskId)) {
      throw new ValidationError('Circular dependency detected', 'CIRCULAR_DEPENDENCY');
    }
  }
}

/**
 * DFS cycle detection from a starting node.
 */
function hasCycle(adjList: Map<string, string[]>, startId: string): boolean {
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(nodeId: string): boolean {
    if (inStack.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;

    visited.add(nodeId);
    inStack.add(nodeId);

    const deps = adjList.get(nodeId) || [];
    for (const dep of deps) {
      if (dfs(dep)) return true;
    }

    inStack.delete(nodeId);
    return false;
  }

  return dfs(startId);
}

export class ValidationError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class TaskManager {
  createTask(input: CreateTaskInput): TaskWithDependencyStatus {
    const db = getDb();
    const id = generateId('task');
    const contextFiles = input.contextFiles ? JSON.stringify(input.contextFiles) : null;

    // Branch handling
    let branch: string | null = null;
    const autoBranch = input.autoBranch ?? true;

    if (input.branch) {
      if (!isValidBranchName(input.branch)) {
        throw new ValidationError('Invalid branch name', 'VALIDATION_ERROR');
      }
      branch = input.branch;
    } else if (autoBranch) {
      branch = generateBranchName(id, input.title);
    }

    // Dependency validation
    const dependsOn = input.dependsOn || [];
    if (dependsOn.length > 0) {
      validateDependencies(input.workspaceId, id, dependsOn);
    }
    const dependsOnJson = dependsOn.length > 0 ? JSON.stringify(dependsOn) : null;

    db.prepare(`
      INSERT INTO tasks (id, workspace_id, title, description, status, priority, branch, depends_on, context_files, updated_at)
      VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, datetime('now'))
    `).run(id, input.workspaceId, input.title, input.description, input.priority ?? 'normal', branch, dependsOnJson, contextFiles);

    return this.getTaskWithDeps(id)!;
  }

  getTask(id: string): Task | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task | undefined;
    return row ?? null;
  }

  getTaskWithDeps(id: string): TaskWithDependencyStatus | null {
    const task = this.getTask(id);
    if (!task) return null;
    return { ...task, dependency_status: this.getDependencyStatus(task) };
  }

  listTasks(workspaceId: string): TaskWithDependencyStatus[] {
    const db = getDb();
    const tasks = db.prepare(
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

    return tasks.map(task => ({
      ...task,
      dependency_status: this.getDependencyStatus(task),
    }));
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

    // Check if any other task depends on this one
    const dependents = this.getDependents(id);
    if (dependents.length > 0) {
      const depNames = dependents.map(t => t.title).join(', ');
      throw new ValidationError(
        `Cannot delete: tasks depend on this one: ${depNames}`,
        'HAS_DEPENDENTS'
      );
    }

    const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    return result.changes > 0;
  }

  /**
   * Get tasks that depend on the given task.
   */
  getDependents(taskId: string): Task[] {
    const db = getDb();
    // Search for tasks whose depends_on JSON contains the given ID
    const allTasks = db.prepare(
      "SELECT * FROM tasks WHERE depends_on IS NOT NULL AND depends_on LIKE ?"
    ).all(`%${taskId}%`) as Task[];

    return allTasks.filter(t => {
      try {
        const deps = JSON.parse(t.depends_on!) as string[];
        return deps.includes(taskId);
      } catch {
        return false;
      }
    });
  }

  /**
   * Calculate the dependency status for a task.
   */
  getDependencyStatus(task: Task): DependencyStatus {
    if (!task.depends_on) return 'ready';

    let deps: string[];
    try {
      deps = JSON.parse(task.depends_on) as string[];
    } catch {
      return 'ready';
    }

    if (deps.length === 0) return 'ready';

    const db = getDb();
    const placeholders = deps.map(() => '?').join(',');
    const depTasks = db.prepare(
      `SELECT id, status FROM tasks WHERE id IN (${placeholders})`
    ).all(...deps) as Array<{ id: string; status: TaskStatus }>;

    if (depTasks.some(d => d.status === 'failed' || d.status === 'cancelled')) {
      return 'blocked';
    }
    if (depTasks.every(d => d.status === 'completed')) {
      return 'ready';
    }
    return 'waiting';
  }
}
