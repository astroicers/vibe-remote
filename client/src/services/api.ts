// API Service

const API_BASE = '/api';

interface FetchOptions extends RequestInit {
  json?: unknown;
}

class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const token = localStorage.getItem('auth_token');

  const headers: HeadersInit = {
    ...(options.headers || {}),
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  if (options.json) {
    (headers as Record<string, string>)['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.json);
    delete options.json;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(
      response.status,
      data.code || 'UNKNOWN_ERROR',
      data.error || 'Request failed'
    );
  }

  return data as T;
}

// Auth API
export const auth = {
  devQuickPair: (deviceName: string) =>
    request<{ token: string; deviceId: string }>('/auth/dev/quick-pair', {
      method: 'POST',
      json: { deviceName },
    }),

  getMe: () =>
    request<{ id: string; name: string; last_seen_at: string }>('/auth/me'),

  pairingStart: () =>
    request<{ code: string; qrCode: string; expiresAt: string }>(
      '/auth/pairing/start',
      { method: 'POST' }
    ),

  pairingComplete: (code: string, deviceName: string) =>
    request<{ token: string; deviceId: string }>('/auth/pairing/complete', {
      method: 'POST',
      json: { code, deviceName },
    }),

  getDevices: () =>
    request<Array<{ id: string; name: string; last_seen_at: string; created_at: string }>>('/auth/devices'),

  revokeDevice: (id: string) =>
    request<{ success: boolean }>(`/auth/devices/${id}`, { method: 'DELETE' }),
};

// Workspace API
export interface Workspace {
  id: string;
  name: string;
  path: string;
  systemPrompt: string | null;
  createdAt: string;
}

export interface ScannedRepo {
  name: string;
  path: string;
  hasGit: boolean;
  isRegistered: boolean;
}

export const workspaces = {
  list: () => request<Workspace[]>('/workspaces'),

  get: (id: string) => request<Workspace>(`/workspaces/${id}`),

  register: (data: { path: string; name?: string }) =>
    request<Workspace>('/workspaces', { method: 'POST', json: data }),

  scan: (dirPath: string) =>
    request<ScannedRepo[]>(`/workspaces/scan?path=${encodeURIComponent(dirPath)}`),

  getDefaultScanPath: () =>
    request<{ path: string }>('/workspaces/scan/default-path'),

  getFiles: (id: string, depth = 3) =>
    request<FileNode>(`/workspaces/${id}/files?depth=${depth}`),

  getGitStatus: (id: string) =>
    request<GitStatus>(`/workspaces/${id}/git/status`),

  getGitDiff: (id: string, staged = false) =>
    request<{ diff: string }>(`/workspaces/${id}/git/diff?staged=${staged}`),

  getGitLog: (id: string, count = 10) =>
    request<GitCommit[]>(`/workspaces/${id}/git/log?count=${count}`),

  getBranches: (id: string) =>
    request<GitBranches>(`/workspaces/${id}/git/branches`),

  stageFiles: (id: string, files: string[]) =>
    request<{ success: boolean }>(`/workspaces/${id}/git/stage`, {
      method: 'POST',
      json: { files },
    }),

  commit: (id: string, message: string) =>
    request<{ success: boolean; hash: string }>(`/workspaces/${id}/git/commit`, {
      method: 'POST',
      json: { message },
    }),

  push: (id: string) =>
    request<{ success: boolean }>(`/workspaces/${id}/git/push`, {
      method: 'POST',
    }),

  pull: (id: string) =>
    request<{ success: boolean }>(`/workspaces/${id}/git/pull`, {
      method: 'POST',
    }),

  checkout: (id: string, branch: string, create = false) =>
    request<{ success: boolean }>(`/workspaces/${id}/git/checkout`, {
      method: 'POST',
      json: { branch, create },
    }),

  discardChanges: (id: string, files: string[]) =>
    request<{ success: boolean }>(`/workspaces/${id}/git/discard`, {
      method: 'POST',
      json: { files },
    }),

  update: (id: string, data: { name?: string; systemPrompt?: string }) =>
    request<Workspace>(`/workspaces/${id}`, { method: 'PATCH', json: data }),

  delete: (id: string) =>
    request<{ success: boolean }>(`/workspaces/${id}`, { method: 'DELETE' }),
};

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: number;
  unstaged: number;
  untracked: number;
  isClean: boolean;
  isGitRepo: boolean;
}

export interface GitCommit {
  hash: string;
  message: string;
  author: string;
  date: string;
}

export interface GitBranches {
  current: string;
  all: string[];
}

// Chat API
export interface Conversation {
  id: string;
  workspace_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  tool_calls?: unknown[];
  tool_results?: unknown[];
  created_at: string;
}

export const chat = {
  listConversations: (workspaceId: string) =>
    request<Conversation[]>(`/chat/conversations?workspaceId=${workspaceId}`),

  getConversation: (id: string) =>
    request<Conversation & { messages: Message[] }>(`/chat/conversations/${id}`),

  createConversation: (data: { title?: string; workspaceId: string }) =>
    request<Conversation>('/chat/conversations', { method: 'POST', json: data }),

  updateConversation: (id: string, title: string) =>
    request<Conversation>(`/chat/conversations/${id}`, {
      method: 'PATCH',
      json: { title },
    }),

  deleteConversation: (id: string) =>
    request<{ success: boolean }>(`/chat/conversations/${id}`, {
      method: 'DELETE',
    }),
};

// Diff API
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
  oldPath?: string;
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
  raw?: string;
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

export const diff = {
  getCurrent: (workspaceId: string) =>
    request<DiffSummary & { workspaceId: string }>(`/diff/current?workspaceId=${workspaceId}`),

  listReviews: (workspaceId: string) =>
    request<DiffReview[]>(`/diff/reviews?workspaceId=${workspaceId}`),

  getReview: (id: string) => request<DiffReview>(`/diff/reviews/${id}`),

  createReview: (workspaceId: string, conversationId?: string) =>
    request<DiffReview>('/diff/reviews', {
      method: 'POST',
      json: { workspaceId, conversationId },
    }),

  approveAll: (id: string) =>
    request<DiffReview>(`/diff/reviews/${id}/approve`, { method: 'POST' }),

  rejectAll: (id: string) =>
    request<DiffReview>(`/diff/reviews/${id}/reject`, { method: 'POST' }),

  applyActions: (
    id: string,
    actions: Array<{ path: string; action: 'approve' | 'reject' | 'stage' | 'discard' }>
  ) =>
    request<{ review: DiffReview; staged: string[]; discarded: string[] }>(
      `/diff/reviews/${id}/actions`,
      { method: 'POST', json: { actions } }
    ),

  addComment: (
    id: string,
    filePath: string,
    content: string,
    lineNumber?: number
  ) =>
    request<DiffComment>(`/diff/reviews/${id}/comments`, {
      method: 'POST',
      json: { filePath, content, lineNumber },
    }),
};

// Notifications API
export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export const notifications = {
  getVapidPublicKey: () =>
    request<{ publicKey: string }>('/notifications/vapid-public-key'),

  getStatus: () => request<{ available: boolean }>('/notifications/status'),

  subscribe: (subscription: PushSubscription) =>
    request<{ success: boolean; subscriptionId: string }>('/notifications/subscribe', {
      method: 'POST',
      json: subscription,
    }),

  unsubscribe: () =>
    request<{ success: boolean }>('/notifications/unsubscribe', {
      method: 'DELETE',
    }),
};

// Templates API
export interface PromptTemplate {
  id: string;
  workspace_id: string | null;
  name: string;
  content: string;
  sort_order: number;
  created_at: string;
}

export const templates = {
  list: (workspaceId: string) =>
    request<PromptTemplate[]>(`/templates?workspaceId=${workspaceId}`),

  create: (data: { workspaceId?: string; name: string; content: string }) =>
    request<PromptTemplate>('/templates', { method: 'POST', json: data }),

  update: (id: string, data: { name?: string; content?: string }) =>
    request<PromptTemplate>(`/templates/${id}`, { method: 'PATCH', json: data }),

  delete: (id: string) =>
    request<{ success: boolean }>(`/templates/${id}`, { method: 'DELETE' }),
};

// Tasks API
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
  depends_on: string | null;
  dependency_status: DependencyStatus;
  context_files: string | null;
  result: string | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
}

export interface CreateTaskData {
  workspaceId: string;
  title: string;
  description: string;
  priority?: TaskPriority;
  contextFiles?: string[];
  branch?: string;
  autoBranch?: boolean;
  dependsOn?: string[];
}

export const tasks = {
  list: (workspaceId: string) =>
    request<Task[]>(`/tasks?workspaceId=${workspaceId}`),

  get: (id: string) =>
    request<Task>(`/tasks/${id}`),

  create: (data: CreateTaskData) =>
    request<Task>('/tasks', { method: 'POST', json: data }),

  update: (id: string, data: Partial<{ title: string; description: string; priority: TaskPriority; status: TaskStatus }>) =>
    request<Task>(`/tasks/${id}`, { method: 'PATCH', json: data }),

  delete: (id: string) =>
    request<{ success: boolean }>(`/tasks/${id}`, { method: 'DELETE' }),

  run: (id: string) =>
    request<Task>(`/tasks/${id}/run`, { method: 'POST' }),

  cancel: (id: string) =>
    request<Task>(`/tasks/${id}/cancel`, { method: 'POST' }),

  getDependents: (id: string) =>
    request<Task[]>(`/tasks/${id}/dependents`),
};

export { ApiError };

// Models API
export interface ModelInfo {
  key: string;
  name: string;
  description: string;
  modelId: string;
}

export interface ModelsResponse {
  models: ModelInfo[];
  default: string;
}

export const models = {
  list: () => request<ModelsResponse>('/models'),
};
