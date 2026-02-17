// WebSocket Chat Handler

import type { WebSocket } from 'ws';
import { z } from 'zod';
import { verifyToken } from '../auth/jwt.js';
import { getDb, generateId } from '../db/index.js';
import { getActiveWorkspace, getWorkspace } from '../workspace/index.js';
import { streamChat } from '../ai/claude.js';
import {
  getConversationHistory,
  saveMessage,
  updateConversationTitle,
} from '../routes/chat.js';

// Message schemas
const chatMessageSchema = z.object({
  type: z.literal('chat_send'),
  conversationId: z.string().optional(),
  message: z.string().min(1),
  selectedFiles: z.array(z.string()).optional(),
});

const authMessageSchema = z.object({
  type: z.literal('auth'),
  token: z.string(),
});

interface AuthenticatedSocket extends WebSocket {
  deviceId?: string;
  deviceName?: string;
  isAuthenticated?: boolean;
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

export function handleChatWebSocket(ws: AuthenticatedSocket): void {
  let isProcessing = false;

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
        send(ws, {
          type: 'error',
          error: 'Rate limit exceeded. Please wait before sending more messages.',
        });
        return;
      }

      // Check if already processing
      if (isProcessing) {
        send(ws, {
          type: 'error',
          error: 'Already processing a message. Please wait.',
        });
        return;
      }

      isProcessing = true;

      try {
        await handleChatMessage(ws, chatParsed.data);
      } catch (error) {
        send(ws, {
          type: 'chat_error',
          error: error instanceof Error ? error.message : 'Chat failed',
        });
      } finally {
        isProcessing = false;
      }

      return;
    }

    // Unknown message type
    send(ws, { type: 'error', error: 'Unknown message type' });
  });

  ws.on('close', () => {
    // Cleanup if needed
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
}

async function handleChatMessage(
  ws: AuthenticatedSocket,
  data: z.infer<typeof chatMessageSchema>
): Promise<void> {
  const db = getDb();

  // Get or create conversation
  let conversationId = data.conversationId;
  let isNewConversation = false;

  if (!conversationId) {
    // Get active workspace
    const workspace = getActiveWorkspace();
    if (!workspace) {
      send(ws, { type: 'chat_error', error: 'No active workspace' });
      return;
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
      conversationId,
    });
  }

  // Get conversation to find workspace
  const conversation = db
    .prepare('SELECT workspace_id FROM conversations WHERE id = ?')
    .get(conversationId) as { workspace_id: string } | undefined;

  if (!conversation) {
    send(ws, { type: 'chat_error', error: 'Conversation not found' });
    return;
  }

  const workspace = getWorkspace(conversation.workspace_id);
  if (!workspace) {
    send(ws, { type: 'chat_error', error: 'Workspace not found' });
    return;
  }

  // Save user message
  saveMessage(conversationId, 'user', data.message);

  // Update title if new conversation
  if (isNewConversation) {
    updateConversationTitle(conversationId, data.message);
  }

  // Get conversation history
  const history = getConversationHistory(conversationId);

  // Send start event
  send(ws, {
    type: 'chat_start',
    conversationId,
  });

  // Accumulate response
  let fullText = '';
  const toolCalls: unknown[] = [];
  const toolResults: unknown[] = [];

  // Stream chat
  await streamChat(
    {
      workspacePath: workspace.path,
      workspaceSystemPrompt: workspace.systemPrompt || undefined,
      selectedFiles: data.selectedFiles,
      conversationHistory: history.slice(-20), // Last 20 messages
      userMessage: data.message,
    },
    {
      onText: (text) => {
        fullText += text;
        send(ws, {
          type: 'chat_chunk',
          conversationId,
          text,
        });
      },
      onToolUse: (tool) => {
        toolCalls.push(tool);
        send(ws, {
          type: 'tool_use',
          conversationId,
          tool: tool.name,
          input: tool.input,
        });
      },
      onToolResult: (result) => {
        toolResults.push(result);
        send(ws, {
          type: 'tool_result',
          conversationId,
          tool: result.name,
          output: result.output.slice(0, 500), // Truncate for WS
          isError: result.isError,
        });
      },
      onComplete: (response) => {
        // Save assistant message
        saveMessage(
          conversationId!,
          'assistant',
          fullText,
          toolCalls.length > 0 ? toolCalls : undefined,
          toolResults.length > 0 ? toolResults : undefined
        );

        send(ws, {
          type: 'chat_complete',
          conversationId,
          modifiedFiles: response.modifiedFiles,
        });

        // If files were modified, send diff ready notification
        if (response.modifiedFiles.length > 0) {
          send(ws, {
            type: 'diff_ready',
            conversationId,
            files: response.modifiedFiles,
          });
        }
      },
      onError: (error) => {
        send(ws, {
          type: 'chat_error',
          conversationId,
          error: error.message,
        });
      },
    }
  );
}
