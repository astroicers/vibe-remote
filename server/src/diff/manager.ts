// Diff Manager - Create and manage diff reviews

import { getDb, generateId } from '../db/index.js';
import { getGitDiff, stageFiles, discardChanges } from '../workspace/git-ops.js';
import { parseDiff } from './parser.js';
import type { DiffReview, FileDiff, DiffComment, FileAction } from './types.js';

// Filter out internal tool config files that should not appear in reviews
const IGNORED_PREFIXES = ['.claude/', '.vscode/', '.idea/'];
export function filterIgnoredFiles(files: FileDiff[]): FileDiff[] {
  return files.filter(
    (f) => !IGNORED_PREFIXES.some((prefix) => f.path.startsWith(prefix))
  );
}

/**
 * Create a new diff review from current git changes
 */
export async function createDiffReview(
  workspaceId: string,
  workspacePath: string,
  conversationId: string
): Promise<DiffReview> {
  const db = getDb();

  // Get current diff
  const diffOutput = await getGitDiff(workspacePath, false);
  const summary = parseDiff(diffOutput);

  summary.files = filterIgnoredFiles(summary.files);

  if (summary.files.length === 0) {
    throw new Error('No changes to review');
  }

  const id = generateId('diff');
  const now = new Date().toISOString();

  // Create diff review record (use NULL for empty conversationId to satisfy foreign key)
  db.prepare(
    `
    INSERT INTO diff_reviews (id, conversation_id, workspace_id, status, files_json)
    VALUES (?, ?, ?, 'pending', ?)
  `
  ).run(id, conversationId || null, workspaceId, JSON.stringify(summary.files));

  return {
    id,
    conversationId,
    workspaceId,
    status: 'pending',
    files: summary.files,
    comments: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Get a diff review by ID
 */
export function getDiffReview(id: string): DiffReview | null {
  const db = getDb();

  const row = db
    .prepare(
      `
    SELECT id, conversation_id, workspace_id, status, files_json, created_at, updated_at
    FROM diff_reviews
    WHERE id = ?
  `
    )
    .get(id) as Record<string, unknown> | undefined;

  if (!row) return null;

  // Get comments
  const comments = db
    .prepare(
      `
    SELECT id, diff_review_id, file_path, line_number, content, author, created_at
    FROM diff_comments
    WHERE diff_review_id = ?
    ORDER BY created_at ASC
  `
    )
    .all(id) as Array<Record<string, unknown>>;

  return {
    id: row.id as string,
    conversationId: row.conversation_id as string,
    workspaceId: row.workspace_id as string,
    status: row.status as DiffReview['status'],
    files: filterIgnoredFiles(JSON.parse(row.files_json as string) as FileDiff[]),
    comments: comments.map((c) => ({
      id: c.id as string,
      diffReviewId: c.diff_review_id as string,
      filePath: c.file_path as string,
      lineNumber: c.line_number as number | undefined,
      content: c.content as string,
      author: c.author as 'user' | 'ai',
      createdAt: c.created_at as string,
    })),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/**
 * List diff reviews for a workspace
 */
export function listDiffReviews(
  workspaceId: string,
  status?: DiffReview['status']
): DiffReview[] {
  const db = getDb();

  let query = `
    SELECT id, conversation_id, workspace_id, status, files_json, created_at, updated_at
    FROM diff_reviews
    WHERE workspace_id = ?
  `;
  const params: unknown[] = [workspaceId];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  query += ' ORDER BY created_at DESC LIMIT 50';

  const rows = db.prepare(query).all(...params) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    id: row.id as string,
    conversationId: row.conversation_id as string,
    workspaceId: row.workspace_id as string,
    status: row.status as DiffReview['status'],
    files: filterIgnoredFiles(JSON.parse(row.files_json as string) as FileDiff[]),
    comments: [], // Don't load comments for list view
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }));
}

/**
 * Update diff review status
 */
export function updateDiffReviewStatus(
  id: string,
  status: DiffReview['status']
): DiffReview | null {
  const db = getDb();

  const result = db
    .prepare(
      `
    UPDATE diff_reviews
    SET status = ?, updated_at = datetime('now')
    WHERE id = ?
  `
    )
    .run(status, id);

  if (result.changes === 0) return null;

  return getDiffReview(id);
}

/**
 * Add a comment to a diff review
 */
export function addDiffComment(
  diffReviewId: string,
  filePath: string,
  content: string,
  author: 'user' | 'ai',
  lineNumber?: number
): DiffComment {
  const db = getDb();
  const id = generateId('cmt');

  db.prepare(
    `
    INSERT INTO diff_comments (id, diff_review_id, file_path, line_number, content, author)
    VALUES (?, ?, ?, ?, ?, ?)
  `
  ).run(id, diffReviewId, filePath, lineNumber || null, content, author);

  // Update diff review timestamp
  db.prepare(
    `
    UPDATE diff_reviews SET updated_at = datetime('now') WHERE id = ?
  `
  ).run(diffReviewId);

  return {
    id,
    diffReviewId,
    filePath,
    lineNumber,
    content,
    author,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Build a feedback prompt from user comments on a diff review.
 * Groups comments by file path and formats them for the AI.
 */
export function buildFeedbackPrompt(
  review: DiffReview,
  comments: DiffComment[],
  filePathFilter?: string[]
): string {
  // Filter comments to user-only and optionally by file path
  let userComments = comments.filter((c) => c.author === 'user');
  if (filePathFilter && filePathFilter.length > 0) {
    userComments = userComments.filter((c) => filePathFilter.includes(c.filePath));
  }

  // Group comments by file path
  const byFile = new Map<string, DiffComment[]>();
  for (const comment of userComments) {
    const existing = byFile.get(comment.filePath) || [];
    existing.push(comment);
    byFile.set(comment.filePath, existing);
  }

  // Build prompt sections
  const preamble =
    review.status === 'rejected'
      ? 'Note: The previous changes were discarded. Please re-implement the changes addressing the following feedback:\n\n'
      : '';

  let prompt = `${preamble}I received review feedback on my previous changes. Please fix the following issues:\n\n## Rejected Files with Comments\n`;

  for (const [filePath, fileComments] of byFile) {
    prompt += `\n### ${filePath}\n`;
    for (const comment of fileComments) {
      const lineInfo = comment.lineNumber ? ` (line ${comment.lineNumber})` : '';
      prompt += `- ${comment.content}${lineInfo}\n`;
    }
  }

  prompt += `\n## Instructions\n`;
  prompt += `- Read each file mentioned above\n`;
  prompt += `- Apply the requested fixes based on the review comments\n`;
  prompt += `- Do NOT modify files that were not mentioned in the feedback\n`;
  prompt += `- After making changes, briefly summarize what you fixed\n`;

  return prompt;
}

/**
 * Apply file actions (approve/reject individual files)
 */
export async function applyFileActions(
  diffReviewId: string,
  workspacePath: string,
  actions: FileAction[]
): Promise<{ staged: string[]; discarded: string[] }> {
  const staged: string[] = [];
  const discarded: string[] = [];

  const toStage: string[] = [];
  const toDiscard: string[] = [];

  for (const action of actions) {
    switch (action.action) {
      case 'approve':
      case 'stage':
        toStage.push(action.path);
        break;
      case 'reject':
      case 'discard':
        toDiscard.push(action.path);
        break;
    }
  }

  // Stage approved files
  if (toStage.length > 0) {
    await stageFiles(workspacePath, toStage);
    staged.push(...toStage);
  }

  // Discard rejected files
  if (toDiscard.length > 0) {
    await discardChanges(workspacePath, toDiscard);
    discarded.push(...toDiscard);
  }

  // Update review status based on actions
  const review = getDiffReview(diffReviewId);

  if (review) {
    const allPaths = review.files.map((f) => f.path);
    const allStaged = allPaths.every((p) => staged.includes(p));
    const allDiscarded = allPaths.every((p) => discarded.includes(p));
    const anyActioned = staged.length > 0 || discarded.length > 0;

    let newStatus: DiffReview['status'] = review.status;
    if (allStaged) {
      newStatus = 'approved';
    } else if (allDiscarded) {
      newStatus = 'rejected';
    } else if (anyActioned) {
      newStatus = 'partial';
    }

    if (newStatus !== review.status) {
      updateDiffReviewStatus(diffReviewId, newStatus);
    }
  }

  return { staged, discarded };
}

/**
 * Approve all changes in a diff review
 */
export async function approveAllChanges(
  diffReviewId: string,
  workspacePath: string
): Promise<void> {
  const review = getDiffReview(diffReviewId);
  if (!review) throw new Error('Diff review not found');

  const filePaths = review.files.map((f) => f.path);
  await stageFiles(workspacePath, filePaths);
  updateDiffReviewStatus(diffReviewId, 'approved');
}

/**
 * Reject all changes in a diff review
 */
export async function rejectAllChanges(
  diffReviewId: string,
  workspacePath: string
): Promise<void> {
  const review = getDiffReview(diffReviewId);
  if (!review) throw new Error('Diff review not found');

  const filePaths = review.files.map((f) => f.path);
  await discardChanges(workspacePath, filePaths);
  updateDiffReviewStatus(diffReviewId, 'rejected');
}
