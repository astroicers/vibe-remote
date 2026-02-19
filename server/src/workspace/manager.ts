import { existsSync, statSync } from 'fs';
import { basename, resolve } from 'path';
import { getDb, generateId } from '../db/index.js';
import { config } from '../config.js';

/**
 * Map a host path to the container path.
 * e.g. /home/ubuntu/myproject → /workspace/myproject
 * If no mapping is configured or path doesn't match, returns the original path.
 */
function mapHostPathToContainer(inputPath: string): string {
  const hostPath = config.WORKSPACE_HOST_PATH;
  if (!hostPath) return inputPath;

  const containerPath = config.WORKSPACE_CONTAINER_PATH;

  // Normalize: ensure no trailing slash
  const normalizedHost = hostPath.replace(/\/+$/, '');
  const normalizedContainer = containerPath.replace(/\/+$/, '');
  const normalizedInput = inputPath.replace(/\/+$/, '');

  if (normalizedInput === normalizedHost || normalizedInput.startsWith(normalizedHost + '/')) {
    return normalizedInput.replace(normalizedHost, normalizedContainer);
  }

  return inputPath;
}

export interface Workspace {
  id: string;
  name: string;
  path: string;
  isActive: boolean;
  systemPrompt: string | null;
  createdAt: string;
}

export function listWorkspaces(): Workspace[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, name, path, is_active, system_prompt, created_at
    FROM workspaces
    ORDER BY is_active DESC, name ASC
  `).all() as Array<{
    id: string;
    name: string;
    path: string;
    is_active: number;
    system_prompt: string | null;
    created_at: string;
  }>;

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    path: row.path,
    isActive: row.is_active === 1,
    systemPrompt: row.system_prompt,
    createdAt: row.created_at,
  }));
}

export function getWorkspace(id: string): Workspace | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT id, name, path, is_active, system_prompt, created_at
    FROM workspaces WHERE id = ?
  `).get(id) as {
    id: string;
    name: string;
    path: string;
    is_active: number;
    system_prompt: string | null;
    created_at: string;
  } | undefined;

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    path: row.path,
    isActive: row.is_active === 1,
    systemPrompt: row.system_prompt,
    createdAt: row.created_at,
  };
}

/**
 * @deprecated Use explicit workspaceId parameter instead. This function relies on the
 * single-active-workspace model which is being replaced by multi-workspace support.
 */
export function getActiveWorkspace(): Workspace | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT id, name, path, is_active, system_prompt, created_at
    FROM workspaces WHERE is_active = 1 LIMIT 1
  `).get() as {
    id: string;
    name: string;
    path: string;
    is_active: number;
    system_prompt: string | null;
    created_at: string;
  } | undefined;

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    path: row.path,
    isActive: true,
    systemPrompt: row.system_prompt,
    createdAt: row.created_at,
  };
}

export interface RegisterWorkspaceInput {
  path: string;
  name?: string;
  setActive?: boolean;
}

export function registerWorkspace(input: RegisterWorkspaceInput): Workspace {
  // Map host path to container path (e.g. /home/ubuntu/x → /workspace/x)
  const mappedPath = mapHostPathToContainer(input.path);
  const absolutePath = resolve(mappedPath);

  // Validate path exists and is a directory
  if (!existsSync(absolutePath)) {
    throw new Error(`Path does not exist: ${absolutePath}`);
  }

  const stats = statSync(absolutePath);
  if (!stats.isDirectory()) {
    throw new Error(`Path is not a directory: ${absolutePath}`);
  }

  const db = getDb();

  // Check if already registered
  const existing = db.prepare('SELECT id FROM workspaces WHERE path = ?').get(absolutePath);
  if (existing) {
    throw new Error(`Workspace already registered: ${absolutePath}`);
  }

  const id = generateId('ws');
  const name = input.name || basename(absolutePath);

  // If setting as active, deactivate all others first
  if (input.setActive) {
    db.prepare('UPDATE workspaces SET is_active = 0').run();
  }

  db.prepare(`
    INSERT INTO workspaces (id, name, path, is_active)
    VALUES (?, ?, ?, ?)
  `).run(id, name, absolutePath, input.setActive ? 1 : 0);

  return {
    id,
    name,
    path: absolutePath,
    isActive: input.setActive ?? false,
    systemPrompt: null,
    createdAt: new Date().toISOString(),
  };
}

/**
 * @deprecated Use explicit workspaceId parameter instead. This function relies on the
 * single-active-workspace model which is being replaced by multi-workspace support.
 */
export function setActiveWorkspace(id: string): Workspace {
  const db = getDb();

  // Check workspace exists
  const workspace = getWorkspace(id);
  if (!workspace) {
    throw new Error(`Workspace not found: ${id}`);
  }

  // Deactivate all, then activate this one
  db.prepare('UPDATE workspaces SET is_active = 0').run();
  db.prepare('UPDATE workspaces SET is_active = 1 WHERE id = ?').run(id);

  return { ...workspace, isActive: true };
}

export function updateWorkspace(id: string, updates: { name?: string; systemPrompt?: string }): Workspace {
  const db = getDb();

  const workspace = getWorkspace(id);
  if (!workspace) {
    throw new Error(`Workspace not found: ${id}`);
  }

  if (updates.name !== undefined) {
    db.prepare('UPDATE workspaces SET name = ? WHERE id = ?').run(updates.name, id);
    workspace.name = updates.name;
  }

  if (updates.systemPrompt !== undefined) {
    db.prepare('UPDATE workspaces SET system_prompt = ? WHERE id = ?').run(updates.systemPrompt, id);
    workspace.systemPrompt = updates.systemPrompt;
  }

  return workspace;
}

export function removeWorkspace(id: string): void {
  const db = getDb();

  const result = db.prepare('DELETE FROM workspaces WHERE id = ?').run(id);
  if (result.changes === 0) {
    throw new Error(`Workspace not found: ${id}`);
  }
}
