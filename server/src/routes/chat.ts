// Chat API Routes

import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../auth/middleware.js';
import { getActiveWorkspace } from '../workspace/index.js';
import { getDb, generateId } from '../db/index.js';
import type { AIMessage } from '../ai/types.js';

const router = Router();

// Apply auth to all chat routes
router.use(authMiddleware);

// List conversations for a workspace
router.get('/conversations', (_req, res) => {
  const workspace = getActiveWorkspace();

  if (!workspace) {
    res.status(400).json({
      error: 'No active workspace',
      code: 'NO_ACTIVE_WORKSPACE',
    });
    return;
  }

  const db = getDb();
  const conversations = db
    .prepare(
      `
    SELECT id, title, created_at, updated_at
    FROM conversations
    WHERE workspace_id = ?
    ORDER BY updated_at DESC
    LIMIT 50
  `
    )
    .all(workspace.id);

  res.json(conversations);
});

// Get conversation with messages
router.get('/conversations/:id', (req, res) => {
  const db = getDb();

  const conversation = db
    .prepare(
      `
    SELECT id, workspace_id, title, created_at, updated_at
    FROM conversations
    WHERE id = ?
  `
    )
    .get(req.params.id);

  if (!conversation) {
    res.status(404).json({
      error: 'Conversation not found',
      code: 'NOT_FOUND',
    });
    return;
  }

  const messages = db
    .prepare(
      `
    SELECT id, role, content, tool_calls, tool_results, created_at
    FROM messages
    WHERE conversation_id = ?
    ORDER BY created_at ASC
  `
    )
    .all(req.params.id);

  // Parse JSON fields
  const parsedMessages = (messages as Array<Record<string, unknown>>).map((msg) => ({
    ...msg,
    tool_calls: msg.tool_calls ? JSON.parse(msg.tool_calls as string) : null,
    tool_results: msg.tool_results ? JSON.parse(msg.tool_results as string) : null,
  }));

  res.json({
    ...conversation,
    messages: parsedMessages,
  });
});

// Create new conversation
const createConversationSchema = z.object({
  title: z.string().optional(),
  workspaceId: z.string().optional(),
});

router.post('/conversations', (req, res) => {
  const parsed = createConversationSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid request',
      code: 'VALIDATION_ERROR',
    });
    return;
  }

  let workspaceId = parsed.data.workspaceId;

  if (!workspaceId) {
    const activeWorkspace = getActiveWorkspace();
    if (!activeWorkspace) {
      res.status(400).json({
        error: 'No active workspace and no workspace ID provided',
        code: 'NO_WORKSPACE',
      });
      return;
    }
    workspaceId = activeWorkspace.id;
  }

  const db = getDb();
  const id = generateId('conv');
  const title = parsed.data.title || 'New Conversation';

  db.prepare(
    `
    INSERT INTO conversations (id, workspace_id, title)
    VALUES (?, ?, ?)
  `
  ).run(id, workspaceId, title);

  const conversation = db
    .prepare('SELECT * FROM conversations WHERE id = ?')
    .get(id);

  res.status(201).json(conversation);
});

// Update conversation title
const updateConversationSchema = z.object({
  title: z.string().min(1),
});

router.patch('/conversations/:id', (req, res) => {
  const parsed = updateConversationSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid request',
      code: 'VALIDATION_ERROR',
    });
    return;
  }

  const db = getDb();

  const result = db
    .prepare(
      `
    UPDATE conversations
    SET title = ?, updated_at = datetime('now')
    WHERE id = ?
  `
    )
    .run(parsed.data.title, req.params.id);

  if (result.changes === 0) {
    res.status(404).json({
      error: 'Conversation not found',
      code: 'NOT_FOUND',
    });
    return;
  }

  const conversation = db
    .prepare('SELECT * FROM conversations WHERE id = ?')
    .get(req.params.id);

  res.json(conversation);
});

// Delete conversation
router.delete('/conversations/:id', (req, res) => {
  const db = getDb();

  // Delete messages first (foreign key)
  db.prepare('DELETE FROM messages WHERE conversation_id = ?').run(req.params.id);

  const result = db
    .prepare('DELETE FROM conversations WHERE id = ?')
    .run(req.params.id);

  if (result.changes === 0) {
    res.status(404).json({
      error: 'Conversation not found',
      code: 'NOT_FOUND',
    });
    return;
  }

  res.json({ success: true });
});

// Get conversation history as AIMessage array (for AI context)
export function getConversationHistory(conversationId: string): AIMessage[] {
  const db = getDb();

  const messages = db
    .prepare(
      `
    SELECT role, content, tool_calls, tool_results
    FROM messages
    WHERE conversation_id = ?
    ORDER BY created_at ASC
  `
    )
    .all(conversationId);

  return (messages as Array<Record<string, unknown>>).map((msg) => {
    // If there are tool calls, reconstruct the content blocks
    if (msg.tool_calls) {
      const toolCalls = JSON.parse(msg.tool_calls as string);
      return {
        role: msg.role as 'user' | 'assistant',
        content: toolCalls,
      };
    }

    // If there are tool results, this is a user message with tool results
    if (msg.tool_results) {
      const toolResults = JSON.parse(msg.tool_results as string);
      return {
        role: 'user' as const,
        content: toolResults,
      };
    }

    return {
      role: msg.role as 'user' | 'assistant',
      content: msg.content as string,
    };
  });
}

// Save a message to conversation
export function saveMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  toolCalls?: unknown[],
  toolResults?: unknown[]
): string {
  const db = getDb();
  const id = generateId('msg');

  db.prepare(
    `
    INSERT INTO messages (id, conversation_id, role, content, tool_calls, tool_results)
    VALUES (?, ?, ?, ?, ?, ?)
  `
  ).run(
    id,
    conversationId,
    role,
    content,
    toolCalls ? JSON.stringify(toolCalls) : null,
    toolResults ? JSON.stringify(toolResults) : null
  );

  // Update conversation timestamp
  db.prepare(
    `
    UPDATE conversations SET updated_at = datetime('now') WHERE id = ?
  `
  ).run(conversationId);

  return id;
}

// Auto-generate title from first message
export function updateConversationTitle(conversationId: string, firstMessage: string): void {
  const db = getDb();

  // Truncate to first 50 chars
  let title = firstMessage.slice(0, 50);
  if (firstMessage.length > 50) {
    title += '...';
  }

  db.prepare(
    `
    UPDATE conversations SET title = ? WHERE id = ? AND title = 'New Conversation'
  `
  ).run(title, conversationId);
}

export default router;
