// Chat API Routes

import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../auth/middleware.js';
import { getWorkspace } from '../workspace/index.js';
import { getDb, generateId } from '../db/index.js';
import { abortRunner } from '../ws/index.js';
import type { AIMessage } from '../ai/types.js';

const router = Router();

// Apply auth to all chat routes
router.use(authMiddleware);

// List conversations for a workspace
router.get('/conversations', (req, res) => {
  const workspaceId = req.query.workspaceId as string | undefined;
  if (!workspaceId) {
    res.status(400).json({
      error: 'workspaceId is required',
      code: 'MISSING_WORKSPACE_ID',
    });
    return;
  }

  const db = getDb();
  const conversations = db
    .prepare(
      `
    SELECT id, title, token_usage, created_at, updated_at
    FROM conversations
    WHERE workspace_id = ?
    ORDER BY updated_at DESC
    LIMIT 50
  `
    )
    .all(workspaceId);

  res.json(conversations);
});

// Get conversation with messages
router.get('/conversations/:id', (req, res) => {
  const db = getDb();

  const conversation = db
    .prepare(
      `
    SELECT id, workspace_id, title, token_usage, created_at, updated_at
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

  // Parse JSON fields (with try-catch for corrupted data)
  const safeJsonParse = (val: unknown): unknown => {
    if (!val) return null;
    try { return JSON.parse(val as string); } catch { return null; }
  };

  const parsedMessages = (messages as Array<Record<string, unknown>>).map((msg) => ({
    ...msg,
    tool_calls: safeJsonParse(msg.tool_calls),
    tool_results: safeJsonParse(msg.tool_results),
  }));

  res.json({
    ...conversation,
    messages: parsedMessages,
  });
});

// Create new conversation
const createConversationSchema = z.object({
  title: z.string().optional(),
  workspaceId: z.string(),
});

router.post('/conversations', (req, res) => {
  const parsed = createConversationSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid request: workspaceId is required',
      code: 'VALIDATION_ERROR',
    });
    return;
  }

  const workspaceId = parsed.data.workspaceId;

  // Validate workspace exists
  const workspace = getWorkspace(workspaceId);
  if (!workspace) {
    res.status(404).json({
      error: 'Workspace not found',
      code: 'WORKSPACE_NOT_FOUND',
    });
    return;
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

// Abort a running conversation
router.post('/conversations/:id/abort', (req, res) => {
  const conversationId = req.params.id;
  const db = getDb();

  const conversation = db
    .prepare('SELECT workspace_id FROM conversations WHERE id = ?')
    .get(conversationId) as { workspace_id: string } | undefined;

  if (!conversation) {
    res.status(404).json({ error: 'Conversation not found', code: 'NOT_FOUND' });
    return;
  }

  const aborted = abortRunner(conversation.workspace_id, conversationId);
  if (!aborted) {
    res.status(404).json({ error: 'No active runner for this conversation', code: 'RUNNER_NOT_FOUND' });
    return;
  }

  res.json({ success: true, message: 'Runner aborted' });
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
      try {
        const toolCalls = JSON.parse(msg.tool_calls as string);
        return {
          role: msg.role as 'user' | 'assistant',
          content: toolCalls,
        };
      } catch {
        // Corrupted JSON — fall through to plain text
      }
    }

    // If there are tool results, this is a user message with tool results
    if (msg.tool_results) {
      try {
        const toolResults = JSON.parse(msg.tool_results as string);
        return {
          role: 'user' as const,
          content: toolResults,
        };
      } catch {
        // Corrupted JSON — fall through to plain text
      }
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

// Export conversation as Markdown
router.get('/conversations/:id/export', (req, res) => {
  const db = getDb();

  interface ConversationRow {
    id: string;
    title: string;
    workspace_id: string;
    token_usage: string | null;
    created_at: string;
  }

  interface MessageRow {
    role: string;
    content: string;
    tool_calls: string | null;
    tool_results: string | null;
    created_at: string;
  }

  const conversation = db
    .prepare(
      `
    SELECT id, title, workspace_id, token_usage, created_at
    FROM conversations
    WHERE id = ?
  `
    )
    .get(req.params.id) as ConversationRow | undefined;

  if (!conversation) {
    res.status(404).json({
      error: 'Conversation not found',
      code: 'CONVERSATION_NOT_FOUND',
    });
    return;
  }

  const messages = db
    .prepare(
      `
    SELECT role, content, tool_calls, tool_results, created_at
    FROM messages
    WHERE conversation_id = ?
    ORDER BY created_at ASC
  `
    )
    .all(req.params.id) as MessageRow[];

  // Build Markdown content
  let markdown = `# ${conversation.title || 'Untitled Conversation'}\n\n`;
  markdown += `**Created:** ${conversation.created_at}\n\n`;

  // Add token usage if available
  if (conversation.token_usage) {
    try {
      const usage = JSON.parse(conversation.token_usage);
      markdown += `**Token Usage:**\n`;
      markdown += `- Input: ${usage.inputTokens?.toLocaleString() || 0}\n`;
      markdown += `- Output: ${usage.outputTokens?.toLocaleString() || 0}\n`;
      markdown += `- Cost: $${usage.costUsd?.toFixed(4) || '0.0000'}\n\n`;
    } catch {
      // Skip invalid JSON
    }
  }

  markdown += `---\n\n`;

  // Add messages
  for (const msg of messages) {
    const roleLabel = msg.role === 'user' ? '**User**' : '**Assistant**';
    const timestamp = msg.created_at;

    markdown += `### ${roleLabel} (${timestamp})\n\n`;
    markdown += `${msg.content}\n\n`;

    // Add tool calls if any
    if (msg.tool_calls) {
      try {
        const tools = JSON.parse(msg.tool_calls);
        if (tools.length > 0) {
          markdown += `<details>\n<summary>Tool Calls (${tools.length})</summary>\n\n`;
          for (const tool of tools) {
            markdown += `\`\`\`json\n${JSON.stringify(tool, null, 2)}\n\`\`\`\n\n`;
          }
          markdown += `</details>\n\n`;
        }
      } catch {
        // Skip invalid JSON
      }
    }

    markdown += `---\n\n`;
  }

  // Set appropriate headers for download
  const filename = `conversation-${conversation.id}.md`;
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(markdown);
});

// Get aggregated token usage stats for workspace
router.get('/usage', (req, res) => {
  const workspaceId = req.query.workspaceId as string | undefined;
  if (!workspaceId) {
    res.status(400).json({
      error: 'workspaceId is required',
      code: 'MISSING_WORKSPACE_ID',
    });
    return;
  }

  const workspace = getWorkspace(workspaceId);
  if (!workspace) {
    res.status(404).json({
      error: 'Workspace not found',
      code: 'WORKSPACE_NOT_FOUND',
    });
    return;
  }

  const db = getDb();

  // Get all conversations with token usage
  const conversations = db
    .prepare(
      `
    SELECT token_usage
    FROM conversations
    WHERE workspace_id = ? AND token_usage IS NOT NULL
  `
    )
    .all(workspaceId) as { token_usage: string }[];

  // Aggregate token usage
  const totalUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    costUsd: 0,
    conversationCount: conversations.length,
  };

  for (const conv of conversations) {
    try {
      const usage = JSON.parse(conv.token_usage);
      totalUsage.inputTokens += usage.inputTokens || 0;
      totalUsage.outputTokens += usage.outputTokens || 0;
      totalUsage.cacheReadTokens += usage.cacheReadTokens || 0;
      totalUsage.cacheCreationTokens += usage.cacheCreationTokens || 0;
      totalUsage.costUsd += usage.costUsd || 0;
    } catch {
      // Skip invalid JSON
    }
  }

  res.json({
    workspace: workspace.name,
    usage: totalUsage,
  });
});

export default router;
