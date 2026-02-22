import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../auth/middleware.js';
import { getDb } from '../db/index.js';

const router = Router();
router.use(authMiddleware);

const settingKeySchema = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/);
const settingValueSchema = z.string().max(2000);
const bulkSettingsSchema = z.object({
  settings: z.record(settingKeySchema, settingValueSchema).refine(
    (obj) => Object.keys(obj).length <= 50,
    { message: 'Too many settings (max 50)' }
  ),
});

// GET / — Get all settings for authenticated device
router.get('/', (req, res) => {
  const db = getDb();
  const deviceId = req.device!.deviceId;
  const rows = db.prepare('SELECT key, value FROM device_settings WHERE device_id = ?').all(deviceId) as Array<{ key: string; value: string }>;
  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  res.json({ settings });
});

// PUT / — Bulk upsert settings
router.put('/', (req, res) => {
  const parsed = bulkSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message, code: 'VALIDATION_ERROR' });
    return;
  }
  const db = getDb();
  const deviceId = req.device!.deviceId;
  const upsert = db.prepare(
    'INSERT OR REPLACE INTO device_settings (device_id, key, value, updated_at) VALUES (?, ?, ?, datetime(\'now\'))'
  );
  const transaction = db.transaction(() => {
    for (const [key, value] of Object.entries(parsed.data.settings)) {
      upsert.run(deviceId, key, value);
    }
  });
  transaction();
  // Return all settings
  const rows = db.prepare('SELECT key, value FROM device_settings WHERE device_id = ?').all(deviceId) as Array<{ key: string; value: string }>;
  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  res.json({ settings });
});

// PATCH /:key — Update single setting
router.patch('/:key', (req, res) => {
  const keyResult = settingKeySchema.safeParse(req.params.key);
  if (!keyResult.success) {
    res.status(400).json({ error: 'Invalid setting key', code: 'VALIDATION_ERROR' });
    return;
  }
  const valueResult = z.object({ value: settingValueSchema }).safeParse(req.body);
  if (!valueResult.success) {
    res.status(400).json({ error: 'Invalid setting value', code: 'VALIDATION_ERROR' });
    return;
  }
  const db = getDb();
  const deviceId = req.device!.deviceId;
  db.prepare(
    'INSERT OR REPLACE INTO device_settings (device_id, key, value, updated_at) VALUES (?, ?, ?, datetime(\'now\'))'
  ).run(deviceId, keyResult.data, valueResult.data.value);
  res.json({ key: keyResult.data, value: valueResult.data.value, updated_at: new Date().toISOString() });
});

// DELETE /:key — Delete single setting
router.delete('/:key', (req, res) => {
  const keyResult = settingKeySchema.safeParse(req.params.key);
  if (!keyResult.success) {
    res.status(400).json({ error: 'Invalid setting key', code: 'VALIDATION_ERROR' });
    return;
  }
  const db = getDb();
  const deviceId = req.device!.deviceId;
  db.prepare('DELETE FROM device_settings WHERE device_id = ? AND key = ?').run(deviceId, keyResult.data);
  res.json({ success: true });
});

export default router;
