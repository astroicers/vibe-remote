// WebSocket Chat Handler

import type { WebSocket } from 'ws';
import { z } from 'zod';
import { verifyToken } from '../auth/jwt.js';
import { getDb, generateId } from '../db/index.js';
import { getWorkspace } from '../workspace/index.js';
import { ClaudeSdkRunner, StreamEvent } from '../ai/claude-sdk.js';
import { resolveModelId } from '../ai/models.js';
import {
  getConversationHistory,
  saveMessage,
  updateConversationTitle,
} from '../routes/chat.js';
import { toolApprovalStore } from './tool-approval.js';
import {
  truncateForHistory,
  truncateHistory,
  checkFileSize,
  formatFileSize,
  LIMITS,
} from '../utils/truncate.js';
import { getWatcher, type FileChangeEvent } from '../workspace/watcher.js';

// Message schemas
const chatMessageSchema = z.object({
  type: z.literal('chat_send'),
  workspaceId: z.string(),
  conversationId: z.string().optional(),
  message: z.string().min(1),
  selectedFiles: z.array(z.string()).optional(),
  model: z.string().optional(),
});

const authMessageSchema = z.object({
  type: z.literal('auth'),
  token: z.string(),
});

const retryMessageSchema = z.object({
  type: z.literal('chat_retry'),
  conversationId: z.string(),
});

const toolApprovalResponseSchema = z.object({
  type: z.literal('tool_approval_response'),
  toolId: z.string(),
  approved: z.boolean(),
  modifiedInput: z.unknown().optional(),
  reason: z.string().optional(),
});

interface AuthenticatedSocket extends WebSocket {
  deviceId?: string;
  deviceName?: string;
  isAuthenticated?: boolean;
}

// Track all connected WebSocket clients for broadcasting
const connectedClients = new Set<AuthenticatedSocket>();

// Initialize watcher callback (runs once — singleton watcher)
const watcher = getWatcher();
watcher.onChanges((workspaceId: string, changes: FileChangeEvent[]) => {
  const event = {
    type: 'files_changed',
    workspaceId,
    files: changes.map(c => ({ type: c.type, path: c.relativePath })),
    timestamp: new Date().toISOString(),
  };
  const payload = JSON.stringify(event);

  for (const client of connectedClients) {
    if (client.readyState === client.OPEN && client.isAuthenticated) {
      client.send(payload);
    }
  }
});

// Broadcast task status changes to all connected clients
export function broadcastTaskStatus(task: Record<string, unknown>): void {
  const event = {
    type: 'task_status',
    task,
    timestamp: new Date().toISOString(),
  };
  const payload = JSON.stringify(event);

  for (const client of connectedClients) {
    if (client.readyState === client.OPEN && client.isAuthenticated) {
      client.send(payload);
    }
  }
}

// Rate limiting
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 10; // 10 messages per minute

function checkRateLimit(deviceId: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(deviceId) || [];

  // Remove old timestamps
  const recentTimestamps = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW);

  if (recentTimestamps.length >= RATE_LIMIT_MAX) {
    return false;
  }

  recentTimestamps.push(now);
  rateLimitMap.set(deviceId, recentTimestamps);
  return true;
}

// Send helper
function send(ws: WebSocket, data: Record<string, unknown>): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

interface RunnerState {
  runner: ClaudeSdkRunner;
  workspaceId: string;
  conversationId: string;
}
const activeRunners = new Map<string, RunnerState>();
const MAX_CONCURRENT_RUNNERS = 3;

function runnerKey(workspaceId: string, conversationId: string): string {
  return `${workspaceId}:${conversationId}`;
}

export function handleChatWebSocket(ws: AuthenticatedSocket): void {
  // Track this client for broadcasting
  connectedClients.add(ws);

  ws.on('message', async (data) => {
    let parsed: unknown;

    try {
      parsed = JSON.parse(data.toString());
    } catch {
      send(ws, { type: 'error', error: 'Invalid JSON' });
      return;
    }

    // Handle auth message
    const authParsed = authMessageSchema.safeParse(parsed);
    if (authParsed.success) {
      try {
        const payload = verifyToken(authParsed.data.token);

        // Verify device exists
        const db = getDb();
        const device = db
          .prepare('SELECT id FROM devices WHERE id = ?')
          .get(payload.deviceId);

        if (!device) {
          send(ws, { type: 'auth_error', error: 'Device not found' });
          return;
        }

        ws.deviceId = payload.deviceId;
        ws.deviceName = payload.deviceName;
        ws.isAuthenticated = true;

        send(ws, { type: 'auth_success', deviceId: payload.deviceId });
        return;
      } catch {
        send(ws, { type: 'auth_error', error: 'Invalid token' });
        return;
      }
    }

    // All other messages require authentication
    if (!ws.isAuthenticated) {
      send(ws, { type: 'error', error: 'Not authenticated' });
      return;
    }

    // Handle chat message
    const chatParsed = chatMessageSchema.safeParse(parsed);
    if (chatParsed.success) {
      // Check rate limit
      if (!checkRateLimit(ws.deviceId!)) {
        send(ws, { type: 'error', error: 'Rate limit exceeded.' });
        return;
      }

      const workspaceId = chatParsed.data.workspaceId;
      const conversationId = chatParsed.data.conversationId;

      // Check per-conversation lock
      if (conversationId) {
        const key = runnerKey(workspaceId, conversationId);
        if (activeRunners.has(key)) {
          send(ws, { type: 'error', error: 'This conversation is already processing.' });
          return;
        }
      }

      // Check global concurrency limit
      if (activeRunners.size >= MAX_CONCURRENT_RUNNERS) {
        send(ws, { type: 'error', error: 'Too many concurrent sessions. Please wait.' });
        return;
      }

      try {
        await handleChatMessage(ws, chatParsed.data, activeRunners);
        // Runner is cleaned up inside handleChatMessage
      } catch (error) {
        send(ws, {
          type: 'chat_error',
          workspaceId,
          conversationId,
          error: error instanceof Error ? error.message : 'Chat failed',
        });
      }

      return;
    }

    // Handle retry message
    const retryParsed = retryMessageSchema.safeParse(parsed);
    if (retryParsed.success) {
      // Check rate limit
      if (!checkRateLimit(ws.deviceId!)) {
        send(ws, {
          type: 'error',
          error: 'Rate limit exceeded. Please wait before retrying.',
        });
        return;
      }

      // Look up workspace from conversation
      const db = getDb();
      const retryConv = db
        .prepare('SELECT workspace_id FROM conversations WHERE id = ?')
        .get(retryParsed.data.conversationId) as { workspace_id: string } | undefined;

      if (!retryConv) {
        send(ws, { type: 'chat_error', error: 'Conversation not found' });
        return;
      }

      const retryWorkspaceId = retryConv.workspace_id;

      // Check per-conversation lock
      const retryKey = runnerKey(retryWorkspaceId, retryParsed.data.conversationId);
      if (activeRunners.has(retryKey)) {
        send(ws, { type: 'error', error: 'This conversation is already processing.' });
        return;
      }

      // Check global concurrency limit
      if (activeRunners.size >= MAX_CONCURRENT_RUNNERS) {
        send(ws, { type: 'error', error: 'Too many concurrent sessions. Please wait.' });
        return;
      }

      try {
        await handleRetryMessage(ws, retryParsed.data.conversationId, activeRunners);
        // Runner is cleaned up inside handleRetryMessage -> handleChatMessage
      } catch (error) {
        send(ws, {
          type: 'chat_error',
          workspaceId: retryWorkspaceId,
          conversationId: retryParsed.data.conversationId,
          error: error instanceof Error ? error.message : 'Retry failed',
        });
      }

      return;
    }

    // Handle tool approval response
    const approvalParsed = toolApprovalResponseSchema.safeParse(parsed);
    if (approvalParsed.success) {
      const { toolId, approved, modifiedInput, reason } = approvalParsed.data;

      if (approved) {
        const success = toolApprovalStore.approve(toolId, modifiedInput);
        if (success) {
          send(ws, { type: 'tool_approval_confirmed', toolId, approved: true });
        } else {
          send(ws, {
            type: 'error',
            error: 'Tool approval not found or already processed',
          });
        }
      } else {
        const success = toolApprovalStore.reject(toolId, reason);
        if (success) {
          send(ws, { type: 'tool_approval_confirmed', toolId, approved: false });
        } else {
          send(ws, {
            type: 'error',
            error: 'Tool approval not found or already processed',
          });
        }
      }

      return;
    }

    // Unknown message type
    send(ws, { type: 'error', error: 'Unknown message type' });
  });

  ws.on('close', () => {
    // Remove from connected clients
    connectedClients.delete(ws);

    // Abort all running Claude SDK queries
    for (const [_key, state] of activeRunners) {
      state.runner.abort();
    }
    activeRunners.clear();

    // Cancel any pending tool approvals for this device
    if (ws.deviceId) {
      const pending = toolApprovalStore.getPendingForDevice(ws.deviceId);
      for (const approval of pending) {
        toolApprovalStore.reject(approval.toolId, 'Connection closed');
      }
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    connectedClients.delete(ws);
    for (const [_key, state] of activeRunners) {
      state.runner.abort();
    }
    activeRunners.clear();
  });
}

async function handleChatMessage(
  ws: AuthenticatedSocket,
  data: z.infer<typeof chatMessageSchema>,
  runners: Map<string, RunnerState>
): Promise<ClaudeSdkRunner> {
  const db = getDb();
  const workspaceId = data.workspaceId;

  // Get or create conversation
  let conversationId = data.conversationId;
  let isNewConversation = false;

  if (!conversationId) {
    // Validate workspace exists
    const workspace = getWorkspace(workspaceId);
    if (!workspace) {
      send(ws, { type: 'chat_error', workspaceId, error: 'Workspace not found' });
      throw new Error('Workspace not found');
    }

    // Create new conversation
    conversationId = generateId('conv');
    db.prepare(
      `
      INSERT INTO conversations (id, workspace_id, title)
      VALUES (?, ?, ?)
    `
    ).run(conversationId, workspace.id, 'New Conversation');

    isNewConversation = true;

    send(ws, {
      type: 'conversation_created',
      workspaceId,
      conversationId,
    });
  }

  // Get conversation to find workspace and session ID
  const conversation = db
    .prepare('SELECT workspace_id, sdk_session_id FROM conversations WHERE id = ?')
    .get(conversationId) as { workspace_id: string; sdk_session_id: string | null } | undefined;

  if (!conversation) {
    send(ws, { type: 'chat_error', workspaceId, conversationId, error: 'Conversation not found' });
    throw new Error('Conversation not found');
  }

  const workspace = getWorkspace(conversation.workspace_id);
  if (!workspace) {
    send(ws, { type: 'chat_error', workspaceId, conversationId, error: 'Workspace not found' });
    throw new Error('Workspace not found');
  }

  // Start watching workspace files if not already watching
  if (!watcher.isWatching(workspace.id)) {
    watcher.watch(workspace.id, workspace.path);
  }

  // Save user message
  saveMessage(conversationId, 'user', data.message);

  // Update title if new conversation
  if (isNewConversation) {
    updateConversationTitle(conversationId, data.message);
  }

  // Get conversation history for context
  const history = getConversationHistory(conversationId);

  // Send start event
  send(ws, {
    type: 'chat_start',
    workspaceId,
    conversationId,
  });

  // Build prompt with context (filter out files that are too large)
  let contextFiles = '';
  const skippedFiles: string[] = [];

  if (data.selectedFiles?.length) {
    const validFiles: string[] = [];

    for (const filePath of data.selectedFiles) {
      const fileCheck = checkFileSize(filePath);

      if (!fileCheck.ok) {
        skippedFiles.push(`${filePath} (${formatFileSize(fileCheck.size)} > ${formatFileSize(fileCheck.limit)})`);
      } else {
        validFiles.push(filePath);
      }
    }

    if (validFiles.length > 0) {
      contextFiles = `\n\nSelected files for context: ${validFiles.join(', ')}`;
    }

    if (skippedFiles.length > 0) {
      // Notify client about skipped files
      send(ws, {
        type: 'files_skipped',
        workspaceId,
        conversationId,
        files: skippedFiles,
        reason: 'File size exceeds limit',
      });
    }
  }

  // Always include history context (session resume is disabled)
  const historyContext =
    history.length > 0
      ? `\n\nRecent conversation:\n${truncateHistory(history, LIMITS.historyCount)
          .map((m) => {
            // Handle both string content and ContentBlock[] (from tool use)
            const contentStr = typeof m.content === 'string'
              ? m.content
              : '[tool interaction]';
            return `${m.role}: ${truncateForHistory(contentStr)}`;
          })
          .join('\n')}`
      : '';

  const prompt = `${data.message}${contextFiles}${historyContext}`;

  // Create Claude SDK runner
  const runner = new ClaudeSdkRunner();

  // Track runner in activeRunners map
  const key = runnerKey(workspaceId, conversationId);
  runners.set(key, { runner, workspaceId, conversationId });

  // Accumulate response for saving
  let fullText = '';
  const toolCalls: unknown[] = [];
  const toolResults: unknown[] = [];

  // Set up event handlers
  runner.on('event', (event: StreamEvent) => {
    switch (event.type) {
      case 'text':
        fullText += event.content || '';
        send(ws, {
          type: 'chat_chunk',
          workspaceId,
          conversationId,
          text: event.content,
        });
        break;

      case 'tool_use':
        toolCalls.push({
          name: event.toolName,
          input: event.toolInput,
        });
        send(ws, {
          type: 'tool_use',
          workspaceId,
          conversationId,
          tool: event.toolName,
          input: event.toolInput,
        });
        break;

      case 'tool_result':
        toolResults.push(event.toolResult);
        send(ws, {
          type: 'tool_result',
          workspaceId,
          conversationId,
          result: event.toolResult,
        });
        break;

      case 'error':
        send(ws, {
          type: 'chat_error',
          workspaceId,
          conversationId,
          error: event.content,
        });
        break;

      case 'done':
        // Will be handled in the run() promise resolution
        break;
    }
  });

  // Run Claude SDK
  try {
    const response = await runner.run(prompt, {
      workspacePath: workspace.path,
      systemPrompt: workspace.systemPrompt || undefined,
      permissionMode: 'bypassPermissions',
      maxTurns: 20,
      resumeSessionId: conversation.sdk_session_id || undefined,
      model: resolveModelId(data.model),
    });

    // Save assistant message
    saveMessage(
      conversationId,
      'assistant',
      fullText || response.fullText,
      toolCalls.length > 0 ? toolCalls : undefined,
      toolResults.length > 0 ? toolResults : undefined
    );

    // Save session ID for future resume (if new or changed)
    if (response.sessionId && response.sessionId !== conversation.sdk_session_id) {
      db.prepare(
        `UPDATE conversations SET sdk_session_id = ?, updated_at = datetime('now') WHERE id = ?`
      ).run(response.sessionId, conversationId);
    }

    // Save token usage to conversation
    if (response.tokenUsage) {
      db.prepare(
        `UPDATE conversations SET token_usage = ?, updated_at = datetime('now') WHERE id = ?`
      ).run(JSON.stringify(response.tokenUsage), conversationId);
    }

    // Send completion event
    send(ws, {
      type: 'chat_complete',
      workspaceId,
      conversationId,
      modifiedFiles: response.modifiedFiles,
      tokenUsage: response.tokenUsage,
    });

    // If files were modified, send diff ready notification
    if (response.modifiedFiles.length > 0) {
      send(ws, {
        type: 'diff_ready',
        workspaceId,
        conversationId,
        files: response.modifiedFiles,
      });
    }
  } catch (error) {
    send(ws, {
      type: 'chat_error',
      workspaceId,
      conversationId,
      error: error instanceof Error ? error.message : 'Chat failed',
    });
    throw error;
  } finally {
    // Always clean up the runner from the map
    runners.delete(key);
  }

  return runner;
}

async function handleRetryMessage(
  ws: AuthenticatedSocket,
  conversationId: string,
  runners: Map<string, RunnerState>
): Promise<ClaudeSdkRunner> {
  const db = getDb();

  // Get the last user message from the conversation
  interface MessageRow {
    content: string;
  }

  const lastUserMessage = db
    .prepare(
      `
    SELECT content
    FROM messages
    WHERE conversation_id = ? AND role = 'user'
    ORDER BY created_at DESC
    LIMIT 1
  `
    )
    .get(conversationId) as MessageRow | undefined;

  if (!lastUserMessage) {
    send(ws, { type: 'chat_error', error: 'No messages to retry' });
    throw new Error('No messages to retry');
  }

  // Get the conversation's workspace
  interface ConversationRow {
    workspace_id: string;
  }

  const conversation = db
    .prepare('SELECT workspace_id FROM conversations WHERE id = ?')
    .get(conversationId) as ConversationRow | undefined;

  if (!conversation) {
    send(ws, { type: 'chat_error', error: 'Conversation not found' });
    throw new Error('Conversation not found');
  }

  const workspaceId = conversation.workspace_id;

  const workspace = getWorkspace(workspaceId);
  if (!workspace) {
    send(ws, { type: 'chat_error', workspaceId, error: 'Workspace not found' });
    throw new Error('Workspace not found');
  }

  // Create a new conversation for the retry
  const newConversationId = generateId('conv');
  db.prepare(
    `
    INSERT INTO conversations (id, workspace_id, title)
    VALUES (?, ?, ?)
  `
  ).run(newConversationId, workspace.id, `Retry: ${lastUserMessage.content.slice(0, 40)}...`);

  send(ws, {
    type: 'conversation_created',
    workspaceId,
    conversationId: newConversationId,
    isRetry: true,
    originalConversationId: conversationId,
  });

  // Re-use the chat message handler with the new conversation
  return handleChatMessage(ws, {
    type: 'chat_send',
    workspaceId,
    conversationId: newConversationId,
    message: lastUserMessage.content,
  }, runners);
}
