// Diff Module

export {
  createDiffReview,
  getDiffReview,
  listDiffReviews,
  updateDiffReviewStatus,
  addDiffComment,
  applyFileActions,
  approveAllChanges,
  rejectAllChanges,
  filterIgnoredFiles,
} from './manager.js';

export { parseDiff, formatDiffSummary, generateUnifiedView } from './parser.js';

export type {
  DiffHunk,
  FileDiff,
  DiffSummary,
  DiffReview,
  DiffComment,
  FileAction,
} from './types.js';
