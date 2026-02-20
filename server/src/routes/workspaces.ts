import { Router } from 'express';
import { z } from 'zod';
import { readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { authMiddleware } from '../auth/middleware.js';
import { config } from '../config.js';
import {
  listWorkspaces,
  getWorkspace,
  getActiveWorkspace,
  registerWorkspace,
  setActiveWorkspace,
  updateWorkspace,
  removeWorkspace,
  getFileTree,
  readFile,
  getGitStatus,
  getGitDiff,
  getRecentCommits,
  gitCommit,
  gitPush,
  gitPull,
  gitCheckout,
  listBranches,
  stageFiles,
  discardChanges,
} from '../workspace/index.js';

const router = Router();

// Apply auth to all workspace routes
router.use(authMiddleware);

// List all workspaces
router.get('/', (_req, res) => {
  const workspaces = listWorkspaces();
  res.json(workspaces);
});

// Get active workspace
router.get('/active', (_req, res) => {
  const workspace = getActiveWorkspace();

  if (!workspace) {
    res.status(404).json({
      error: 'No active workspace',
      code: 'NO_ACTIVE_WORKSPACE',
    });
    return;
  }

  res.json(workspace);
});

// Scan a directory for git repositories (immediate subdirectories with .git)
router.get('/scan', (req, res) => {
  const scanPath = req.query.path as string | undefined;
  if (!scanPath) {
    res.status(400).json({
      error: 'path query parameter is required',
      code: 'MISSING_PATH',
    });
    return;
  }

  // Map host path to container path if running in Docker
  let resolvedPath = scanPath;
  const hostPath = config.WORKSPACE_HOST_PATH;
  if (hostPath) {
    const containerPath = config.WORKSPACE_CONTAINER_PATH;
    const normalizedHost = hostPath.replace(/\/+$/, '');
    const normalizedContainer = containerPath.replace(/\/+$/, '');
    const normalizedInput = scanPath.replace(/\/+$/, '');
    if (normalizedInput === normalizedHost || normalizedInput.startsWith(normalizedHost + '/')) {
      resolvedPath = normalizedInput.replace(normalizedHost, normalizedContainer);
    }
  }

  if (!existsSync(resolvedPath)) {
    res.status(404).json({
      error: `Path does not exist: ${scanPath}`,
      code: 'PATH_NOT_FOUND',
    });
    return;
  }

  try {
    const entries = readdirSync(resolvedPath, { withFileTypes: true });
    const repos: Array<{ name: string; path: string; hasGit: boolean }> = [];

    // Get already registered workspace paths
    const registered = new Set(listWorkspaces().map((w) => w.path));

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      // Skip hidden directories
      if (entry.name.startsWith('.')) continue;

      const fullPath = join(resolvedPath, entry.name);
      const gitPath = join(fullPath, '.git');
      const hasGit = existsSync(gitPath);

      if (hasGit) {
        repos.push({
          name: entry.name,
          // Return the host path (not container path) so client can display what user expects
          path: hostPath
            ? fullPath.replace(config.WORKSPACE_CONTAINER_PATH.replace(/\/+$/, ''), hostPath.replace(/\/+$/, ''))
            : fullPath,
          hasGit: true,
        });
      }
    }

    // Sort alphabetically
    repos.sort((a, b) => a.name.localeCompare(b.name));

    // Mark which ones are already registered
    const result = repos.map((repo) => {
      // Check both host and container paths
      const containerPathForRepo = hostPath
        ? repo.path.replace(hostPath.replace(/\/+$/, ''), config.WORKSPACE_CONTAINER_PATH.replace(/\/+$/, ''))
        : repo.path;
      return {
        ...repo,
        isRegistered: registered.has(repo.path) || registered.has(containerPathForRepo),
      };
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to scan directory',
      code: 'SCAN_ERROR',
    });
  }
});

// Get workspace by ID
router.get('/:id', (req, res) => {
  const workspace = getWorkspace(req.params.id);

  if (!workspace) {
    res.status(404).json({
      error: 'Workspace not found',
      code: 'NOT_FOUND',
    });
    return;
  }

  res.json(workspace);
});

// Register new workspace
const registerSchema = z.object({
  path: z.string().min(1),
  name: z.string().optional(),
  setActive: z.boolean().optional(),
});

router.post('/', (req, res) => {
  const parsed = registerSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid request body',
      code: 'VALIDATION_ERROR',
      details: parsed.error.format(),
    });
    return;
  }

  try {
    const workspace = registerWorkspace(parsed.data);
    res.status(201).json(workspace);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to register workspace',
      code: 'REGISTRATION_ERROR',
    });
  }
});

// Set active workspace
router.post('/:id/activate', (req, res) => {
  try {
    const workspace = setActiveWorkspace(req.params.id);
    res.json(workspace);
  } catch (error) {
    res.status(404).json({
      error: error instanceof Error ? error.message : 'Workspace not found',
      code: 'NOT_FOUND',
    });
  }
});

// Update workspace
const updateSchema = z.object({
  name: z.string().optional(),
  systemPrompt: z.string().optional(),
});

router.patch('/:id', (req, res) => {
  const parsed = updateSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid request body',
      code: 'VALIDATION_ERROR',
      details: parsed.error.format(),
    });
    return;
  }

  try {
    const workspace = updateWorkspace(req.params.id, parsed.data);
    res.json(workspace);
  } catch (error) {
    res.status(404).json({
      error: error instanceof Error ? error.message : 'Workspace not found',
      code: 'NOT_FOUND',
    });
  }
});

// Remove workspace
router.delete('/:id', (req, res) => {
  try {
    removeWorkspace(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(404).json({
      error: error instanceof Error ? error.message : 'Workspace not found',
      code: 'NOT_FOUND',
    });
  }
});

// ============================================
// File Tree & Files
// ============================================

// Get file tree
router.get('/:id/files', (req, res) => {
  const workspace = getWorkspace(req.params.id);

  if (!workspace) {
    res.status(404).json({ error: 'Workspace not found', code: 'NOT_FOUND' });
    return;
  }

  const maxDepth = parseInt(req.query.depth as string) || 5;
  const tree = getFileTree(workspace.path, { maxDepth });

  res.json(tree);
});

// Read file content
router.get('/:id/files/*', (req, res) => {
  const workspace = getWorkspace(req.params.id);

  if (!workspace) {
    res.status(404).json({ error: 'Workspace not found', code: 'NOT_FOUND' });
    return;
  }

  // Get file path from wildcard URL segment
  // Express stores wildcard (*) matches in params[0]
  const filePath = (req.params as unknown as { 0: string })[0];

  if (!filePath) {
    res.status(400).json({ error: 'File path required', code: 'INVALID_PATH' });
    return;
  }

  try {
    const content = readFile(workspace.path, filePath);
    res.json({ path: filePath, content });
  } catch (error) {
    res.status(404).json({
      error: error instanceof Error ? error.message : 'File not found',
      code: 'FILE_ERROR',
    });
  }
});

// ============================================
// Git Operations
// ============================================

// Get git status
router.get('/:id/git/status', async (req, res) => {
  const workspace = getWorkspace(req.params.id);

  if (!workspace) {
    res.status(404).json({ error: 'Workspace not found', code: 'NOT_FOUND' });
    return;
  }

  const status = await getGitStatus(workspace.path);
  res.json(status);
});

// Get git diff
router.get('/:id/git/diff', async (req, res) => {
  const workspace = getWorkspace(req.params.id);

  if (!workspace) {
    res.status(404).json({ error: 'Workspace not found', code: 'NOT_FOUND' });
    return;
  }

  const staged = req.query.staged === 'true';
  const diff = await getGitDiff(workspace.path, staged);
  res.json({ diff });
});

// Get recent commits
router.get('/:id/git/log', async (req, res) => {
  const workspace = getWorkspace(req.params.id);

  if (!workspace) {
    res.status(404).json({ error: 'Workspace not found', code: 'NOT_FOUND' });
    return;
  }

  const count = parseInt(req.query.count as string) || 10;
  const commits = await getRecentCommits(workspace.path, count);
  res.json(commits);
});

// List branches
router.get('/:id/git/branches', async (req, res) => {
  const workspace = getWorkspace(req.params.id);

  if (!workspace) {
    res.status(404).json({ error: 'Workspace not found', code: 'NOT_FOUND' });
    return;
  }

  const branches = await listBranches(workspace.path);
  res.json(branches);
});

// Stage files
const stageSchema = z.object({
  files: z.array(z.string()).min(1),
});

router.post('/:id/git/stage', async (req, res) => {
  const workspace = getWorkspace(req.params.id);

  if (!workspace) {
    res.status(404).json({ error: 'Workspace not found', code: 'NOT_FOUND' });
    return;
  }

  const parsed = stageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', code: 'VALIDATION_ERROR' });
    return;
  }

  try {
    await stageFiles(workspace.path, parsed.data.files);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Stage failed',
      code: 'GIT_ERROR',
    });
  }
});

// Commit
const commitSchema = z.object({
  message: z.string().min(1),
});

router.post('/:id/git/commit', async (req, res) => {
  const workspace = getWorkspace(req.params.id);

  if (!workspace) {
    res.status(404).json({ error: 'Workspace not found', code: 'NOT_FOUND' });
    return;
  }

  const parsed = commitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Commit message required', code: 'VALIDATION_ERROR' });
    return;
  }

  try {
    const hash = await gitCommit(workspace.path, parsed.data.message);
    res.json({ success: true, hash });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Commit failed',
      code: 'GIT_ERROR',
    });
  }
});

// Push
router.post('/:id/git/push', async (req, res) => {
  const workspace = getWorkspace(req.params.id);

  if (!workspace) {
    res.status(404).json({ error: 'Workspace not found', code: 'NOT_FOUND' });
    return;
  }

  try {
    await gitPush(workspace.path);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Push failed',
      code: 'GIT_ERROR',
    });
  }
});

// Pull
router.post('/:id/git/pull', async (req, res) => {
  const workspace = getWorkspace(req.params.id);

  if (!workspace) {
    res.status(404).json({ error: 'Workspace not found', code: 'NOT_FOUND' });
    return;
  }

  try {
    await gitPull(workspace.path);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Pull failed',
      code: 'GIT_ERROR',
    });
  }
});

// Checkout branch
const checkoutSchema = z.object({
  branch: z.string().min(1),
  create: z.boolean().optional(),
});

router.post('/:id/git/checkout', async (req, res) => {
  const workspace = getWorkspace(req.params.id);

  if (!workspace) {
    res.status(404).json({ error: 'Workspace not found', code: 'NOT_FOUND' });
    return;
  }

  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Branch name required', code: 'VALIDATION_ERROR' });
    return;
  }

  try {
    await gitCheckout(workspace.path, parsed.data.branch, parsed.data.create);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Checkout failed',
      code: 'GIT_ERROR',
    });
  }
});

// Discard changes
const discardSchema = z.object({
  files: z.array(z.string()).min(1),
});

router.post('/:id/git/discard', async (req, res) => {
  const workspace = getWorkspace(req.params.id);

  if (!workspace) {
    res.status(404).json({ error: 'Workspace not found', code: 'NOT_FOUND' });
    return;
  }

  const parsed = discardSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Files required', code: 'VALIDATION_ERROR' });
    return;
  }

  try {
    await discardChanges(workspace.path, parsed.data.files);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Discard failed',
      code: 'GIT_ERROR',
    });
  }
});

export default router;
