// Diff Types

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  content: string;
}

export interface FileDiff {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  oldPath?: string; // For renamed files
  insertions: number;
  deletions: number;
  hunks: DiffHunk[];
  isBinary: boolean;
}

export interface DiffSummary {
  files: FileDiff[];
  totalInsertions: number;
  totalDeletions: number;
  totalFiles: number;
}

export interface DiffReview {
  id: string;
  conversationId: string;
  workspaceId: string;
  status: 'pending' | 'approved' | 'rejected' | 'partial';
  files: FileDiff[];
  comments: DiffComment[];
  createdAt: string;
  updatedAt: string;
}

export interface DiffComment {
  id: string;
  diffReviewId: string;
  filePath: string;
  lineNumber?: number;
  content: string;
  author: 'user' | 'ai';
  createdAt: string;
}

export interface FileAction {
  path: string;
  action: 'approve' | 'reject' | 'stage' | 'discard';
}
