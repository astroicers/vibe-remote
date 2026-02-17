// Diff Review API Routes

import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../auth/middleware.js';
import { getWorkspace, getActiveWorkspace } from '../workspace/index.js';
import { getGitDiff } from '../workspace/git-ops.js';
import {
  createDiffReview,
  getDiffReview,
  listDiffReviews,
  updateDiffReviewStatus,
  addDiffComment,
  applyFileActions,
  approveAllChanges,
  rejectAllChanges,
  parseDiff,
  generateUnifiedView,
} from '../diff/index.js';

const router = Router();

// Apply auth to all diff routes
router.use(authMiddleware);

// Get current git diff for active workspace
router.get('/current', async (_req, res) => {
  const workspace = getActiveWorkspace();

  if (!workspace) {
    res.status(400).json({
      error: 'No active workspace',
      code: 'NO_ACTIVE_WORKSPACE',
    });
    return;
  }

  try {
    const diffOutput = await getGitDiff(workspace.path, false);
    const summary = parseDiff(diffOutput);

    res.json({
      workspaceId: workspace.id,
      ...summary,
      raw: diffOutput,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to get diff',
      code: 'GIT_ERROR',
    });
  }
});

// List diff reviews for active workspace
router.get('/reviews', (_req, res) => {
  const workspace = getActiveWorkspace();

  if (!workspace) {
    res.status(400).json({
      error: 'No active workspace',
      code: 'NO_ACTIVE_WORKSPACE',
    });
    return;
  }

  const reviews = listDiffReviews(workspace.id);
  res.json(reviews);
});

// Get a specific diff review
router.get('/reviews/:id', (req, res) => {
  const review = getDiffReview(req.params.id);

  if (!review) {
    res.status(404).json({
      error: 'Diff review not found',
      code: 'NOT_FOUND',
    });
    return;
  }

  res.json(review);
});

// Create a new diff review from current changes
const createReviewSchema = z.object({
  conversationId: z.string().optional(),
});

router.post('/reviews', async (req, res) => {
  const workspace = getActiveWorkspace();

  if (!workspace) {
    res.status(400).json({
      error: 'No active workspace',
      code: 'NO_ACTIVE_WORKSPACE',
    });
    return;
  }

  const parsed = createReviewSchema.safeParse(req.body);
  const conversationId = parsed.success ? parsed.data.conversationId : undefined;

  try {
    const review = await createDiffReview(
      workspace.id,
      workspace.path,
      conversationId || ''
    );
    res.status(201).json(review);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to create diff review',
      code: 'DIFF_ERROR',
    });
  }
});

// Get unified view for a specific file in a diff review
router.get('/reviews/:id/files/:filePath(*)', (req, res) => {
  const review = getDiffReview(req.params.id);

  if (!review) {
    res.status(404).json({
      error: 'Diff review not found',
      code: 'NOT_FOUND',
    });
    return;
  }

  const filePath = (req.params as unknown as { filePath: string }).filePath;
  const file = review.files.find((f) => f.path === filePath);

  if (!file) {
    res.status(404).json({
      error: 'File not found in diff review',
      code: 'FILE_NOT_FOUND',
    });
    return;
  }

  const unifiedView = generateUnifiedView(file);
  res.json({
    file,
    unifiedView,
  });
});

// Update diff review status
const updateStatusSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'partial']),
});

router.patch('/reviews/:id/status', (req, res) => {
  const parsed = updateStatusSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid status',
      code: 'VALIDATION_ERROR',
    });
    return;
  }

  const review = updateDiffReviewStatus(req.params.id, parsed.data.status);

  if (!review) {
    res.status(404).json({
      error: 'Diff review not found',
      code: 'NOT_FOUND',
    });
    return;
  }

  res.json(review);
});

// Approve all changes
router.post('/reviews/:id/approve', async (req, res) => {
  const review = getDiffReview(req.params.id);

  if (!review) {
    res.status(404).json({
      error: 'Diff review not found',
      code: 'NOT_FOUND',
    });
    return;
  }

  const workspace = getWorkspace(review.workspaceId);
  if (!workspace) {
    res.status(404).json({
      error: 'Workspace not found',
      code: 'WORKSPACE_NOT_FOUND',
    });
    return;
  }

  try {
    await approveAllChanges(req.params.id, workspace.path);
    const updatedReview = getDiffReview(req.params.id);
    res.json(updatedReview);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to approve changes',
      code: 'GIT_ERROR',
    });
  }
});

// Reject all changes
router.post('/reviews/:id/reject', async (req, res) => {
  const review = getDiffReview(req.params.id);

  if (!review) {
    res.status(404).json({
      error: 'Diff review not found',
      code: 'NOT_FOUND',
    });
    return;
  }

  const workspace = getWorkspace(review.workspaceId);
  if (!workspace) {
    res.status(404).json({
      error: 'Workspace not found',
      code: 'WORKSPACE_NOT_FOUND',
    });
    return;
  }

  try {
    await rejectAllChanges(req.params.id, workspace.path);
    const updatedReview = getDiffReview(req.params.id);
    res.json(updatedReview);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to reject changes',
      code: 'GIT_ERROR',
    });
  }
});

// Apply file actions (approve/reject individual files)
const fileActionsSchema = z.object({
  actions: z.array(
    z.object({
      path: z.string(),
      action: z.enum(['approve', 'reject', 'stage', 'discard']),
    })
  ),
});

router.post('/reviews/:id/actions', async (req, res) => {
  const review = getDiffReview(req.params.id);

  if (!review) {
    res.status(404).json({
      error: 'Diff review not found',
      code: 'NOT_FOUND',
    });
    return;
  }

  const parsed = fileActionsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid request',
      code: 'VALIDATION_ERROR',
    });
    return;
  }

  const workspace = getWorkspace(review.workspaceId);
  if (!workspace) {
    res.status(404).json({
      error: 'Workspace not found',
      code: 'WORKSPACE_NOT_FOUND',
    });
    return;
  }

  try {
    const result = await applyFileActions(
      req.params.id,
      workspace.path,
      parsed.data.actions
    );
    const updatedReview = getDiffReview(req.params.id);
    res.json({
      review: updatedReview,
      ...result,
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to apply actions',
      code: 'GIT_ERROR',
    });
  }
});

// Add a comment to a diff review
const addCommentSchema = z.object({
  filePath: z.string(),
  content: z.string().min(1),
  lineNumber: z.number().optional(),
});

router.post('/reviews/:id/comments', (req, res) => {
  const review = getDiffReview(req.params.id);

  if (!review) {
    res.status(404).json({
      error: 'Diff review not found',
      code: 'NOT_FOUND',
    });
    return;
  }

  const parsed = addCommentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid request',
      code: 'VALIDATION_ERROR',
    });
    return;
  }

  const comment = addDiffComment(
    req.params.id,
    parsed.data.filePath,
    parsed.data.content,
    'user',
    parsed.data.lineNumber
  );

  res.status(201).json(comment);
});

export default router;
