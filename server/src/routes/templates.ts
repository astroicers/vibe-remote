// Prompt Templates API Routes

import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../auth/middleware.js';
import { getDb, generateId } from '../db/index.js';

const router = Router();

// Apply auth to all template routes
router.use(authMiddleware);

// List templates (global + workspace-specific)
router.get('/', (req, res) => {
  const workspaceId = req.query.workspaceId as string | undefined;
  if (!workspaceId) {
    res.status(400).json({
      error: 'workspaceId is required',
      code: 'MISSING_WORKSPACE_ID',
    });
    return;
  }

  const db = getDb();
  const templates = db
    .prepare(
      `
    SELECT id, workspace_id, name, content, sort_order, created_at
    FROM prompt_templates
    WHERE workspace_id IS NULL OR workspace_id = ?
    ORDER BY sort_order ASC, created_at ASC
  `
    )
    .all(workspaceId);

  res.json(templates);
});

// Create template
const createTemplateSchema = z.object({
  workspaceId: z.string().optional(),
  name: z.string().min(1, 'Name is required'),
  content: z.string().min(1, 'Content is required'),
});

router.post('/', (req, res) => {
  const parsed = createTemplateSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid request: name and content are required',
      code: 'VALIDATION_ERROR',
    });
    return;
  }

  const { workspaceId, name, content } = parsed.data;

  const db = getDb();
  const id = generateId('tpl');

  // Get the next sort_order
  const maxOrder = db
    .prepare(
      `
    SELECT COALESCE(MAX(sort_order), 0) as max_order
    FROM prompt_templates
    WHERE workspace_id IS ? OR workspace_id = ?
  `
    )
    .get(workspaceId ?? null, workspaceId ?? null) as { max_order: number };

  const sortOrder = maxOrder.max_order + 1;

  db.prepare(
    `
    INSERT INTO prompt_templates (id, workspace_id, name, content, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `
  ).run(id, workspaceId ?? null, name, content, sortOrder);

  const template = db
    .prepare('SELECT id, workspace_id, name, content, sort_order, created_at FROM prompt_templates WHERE id = ?')
    .get(id);

  res.status(201).json(template);
});

// Update template
const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
});

router.patch('/:id', (req, res) => {
  const parsed = updateTemplateSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid request',
      code: 'VALIDATION_ERROR',
    });
    return;
  }

  const { name, content } = parsed.data;

  if (!name && !content) {
    res.status(400).json({
      error: 'At least one of name or content must be provided',
      code: 'VALIDATION_ERROR',
    });
    return;
  }

  const db = getDb();

  // Build dynamic update
  const updates: string[] = [];
  const values: unknown[] = [];

  if (name) {
    updates.push('name = ?');
    values.push(name);
  }
  if (content) {
    updates.push('content = ?');
    values.push(content);
  }

  values.push(req.params.id);

  const result = db
    .prepare(`UPDATE prompt_templates SET ${updates.join(', ')} WHERE id = ?`)
    .run(...values);

  if (result.changes === 0) {
    res.status(404).json({
      error: 'Template not found',
      code: 'NOT_FOUND',
    });
    return;
  }

  const template = db
    .prepare('SELECT id, workspace_id, name, content, sort_order, created_at FROM prompt_templates WHERE id = ?')
    .get(req.params.id);

  res.json(template);
});

// Delete template
router.delete('/:id', (req, res) => {
  const db = getDb();

  const result = db
    .prepare('DELETE FROM prompt_templates WHERE id = ?')
    .run(req.params.id);

  if (result.changes === 0) {
    res.status(404).json({
      error: 'Template not found',
      code: 'NOT_FOUND',
    });
    return;
  }

  res.json({ success: true });
});

export default router;
