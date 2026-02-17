import { Router } from 'express';
import { z } from 'zod';
import {
  createPairingSession,
  generatePairingQR,
  completePairing,
  devQuickPair,
} from '../auth/pairing.js';
import { authMiddleware } from '../auth/middleware.js';
import { getDb } from '../db/index.js';
import { config } from '../config.js';

const router = Router();

// Generate pairing QR code
router.post('/pairing/start', async (req, res) => {
  try {
    // Get server URL from request or config
    const protocol = req.secure ? 'https' : 'http';
    const host = req.get('host') || `${config.HOST}:${config.PORT}`;
    const serverUrl = `${protocol}://${host}`;

    const session = createPairingSession(serverUrl);
    const qrCode = await generatePairingQR(session);

    res.json({
      code: session.code,
      qrCode,
      expiresAt: new Date(session.expiresAt).toISOString(),
    });
  } catch (error) {
    console.error('Pairing start error:', error);
    res.status(500).json({
      error: 'Failed to start pairing session',
      code: 'PAIRING_ERROR',
    });
  }
});

// Complete pairing (called from mobile app)
const pairSchema = z.object({
  code: z.string().length(6),
  deviceName: z.string().min(1).max(100),
});

router.post('/pairing/complete', (req, res) => {
  const parsed = pairSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid request body',
      code: 'VALIDATION_ERROR',
      details: parsed.error.format(),
    });
    return;
  }

  const { code, deviceName } = parsed.data;
  const result = completePairing(code, deviceName);

  if (!result.success) {
    res.status(400).json({
      error: result.error,
      code: 'PAIRING_FAILED',
    });
    return;
  }

  res.json({
    token: result.token,
    deviceId: result.deviceId,
  });
});

// Dev-only: quick pair without QR
router.post('/dev/quick-pair', (req, res) => {
  if (config.NODE_ENV !== 'development') {
    res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
    return;
  }

  const deviceName = req.body.deviceName || 'Dev Device';
  const result = devQuickPair(deviceName);

  res.json(result);
});

// Get current device info
router.get('/me', authMiddleware, (req, res) => {
  const db = getDb();
  const device = db.prepare(`
    SELECT id, name, last_seen_at, created_at
    FROM devices WHERE id = ?
  `).get(req.device!.deviceId);

  if (!device) {
    res.status(404).json({
      error: 'Device not found',
      code: 'NOT_FOUND',
    });
    return;
  }

  res.json(device);
});

// List all devices
router.get('/devices', authMiddleware, (_req, res) => {
  const db = getDb();
  const devices = db.prepare(`
    SELECT id, name, last_seen_at, created_at
    FROM devices ORDER BY last_seen_at DESC
  `).all();

  res.json(devices);
});

// Revoke a device
router.delete('/devices/:id', authMiddleware, (req, res) => {
  const db = getDb();

  // Delete push subscriptions first
  db.prepare('DELETE FROM push_subscriptions WHERE device_id = ?').run(req.params.id);

  // Delete device
  const result = db.prepare('DELETE FROM devices WHERE id = ?').run(req.params.id);

  if (result.changes === 0) {
    res.status(404).json({
      error: 'Device not found',
      code: 'NOT_FOUND',
    });
    return;
  }

  res.json({ success: true });
});

export default router;
