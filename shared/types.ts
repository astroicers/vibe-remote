// ============================================
// Shared Types for Vibe Remote
// ============================================

// --------------------------------------------
// Auth
// --------------------------------------------
export interface Device {
  id: string;
  name: string;
  lastSeen: string;
  createdAt: string;
}

export interface AuthToken {
  token: string;
  expiresAt: string;
  deviceId: string;
}

// --------------------------------------------
// Workspace
// --------------------------------------------
export interface Workspace {
  id: string;
  name: string;
  path: string;
  isActive: boolean;
  createdAt: string;
}

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: number;
  unstaged: number;
  untracked: number;
  isClean: boolean;
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
}

// --------------------------------------------
// Chat / Conversation
// --------------------------------------------
export type MessageRole = 'user' | 'assistant';

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  toolCalls?: ToolCall[];
  fileModifications?: FileModification[];
  createdAt: string;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface FileModification {
  path: string;
  action: 'create' | 'modify' | 'delete';
  additions: number;
  deletions: number;
}

export interface Conversation {
  id: string;
  workspaceId: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
}

// --------------------------------------------
// Diff Review
// --------------------------------------------
export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'commented';

export interface DiffFile {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
  reviewStatus: ReviewStatus;
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffLine {
  type: 'add' | 'del' | 'context';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface ReviewComment {
  id: string;
  diffFileId: string;
  lineNumber?: number;
  content: string;
  createdAt: string;
}

// --------------------------------------------
// Tasks (Phase 2)
// --------------------------------------------
export type TaskStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'awaiting_review'
  | 'approved'
  | 'committed'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';
export type DependencyStatus = 'ready' | 'waiting' | 'blocked';

export interface Task {
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  progress?: number;
  branch?: string;
  dependsOn?: string[];
  dependencyStatus?: DependencyStatus;
  contextFiles?: string[];
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

// --------------------------------------------
// WebSocket Events
// --------------------------------------------
export type WSEventType =
  | 'connected'
  | 'ack'
  | 'error'
  | 'chat:message'
  | 'chat:chunk'
  | 'chat:tool_call'
  | 'chat:complete'
  | 'diff:ready'
  | 'diff:updated'
  | 'task:status'
  | 'workspace:changed'
  | 'task:progress'
  | 'task:tool_use'
  | 'task:tool_result'
  | 'task:complete'
  | 'notification';

export interface WSEvent<T = unknown> {
  type: WSEventType;
  timestamp: string;
  payload?: T;
}

// --------------------------------------------
// API Responses
// --------------------------------------------
export interface ApiError {
  error: string;
  code: string;
  details?: unknown;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
