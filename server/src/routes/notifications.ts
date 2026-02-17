// Notifications Routes - Push subscription management

import { Router } from 'express';
import { z } from 'zod';
import {
  isPushAvailable,
  getVapidPublicKey,
  saveSubscription,
  removeSubscription,
  type PushSubscription,
} from '../notifications/index.js';

const router = Router();

// Schema for push subscription
const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

// GET /api/notifications/vapid-public-key
// Get VAPID public key for push notifications
router.get('/vapid-public-key', (_req, res): void => {
  const publicKey = getVapidPublicKey();

  if (!publicKey) {
    res.status(503).json({
      error: 'Push notifications not configured',
      code: 'PUSH_NOT_AVAILABLE',
    });
    return;
  }

  res.json({ publicKey });
});

// GET /api/notifications/status
// Check if push notifications are available
router.get('/status', (_req, res): void => {
  res.json({
    available: isPushAvailable(),
  });
});

// POST /api/notifications/subscribe
// Subscribe to push notifications
router.post('/subscribe', (req, res): void => {
  if (!isPushAvailable()) {
    res.status(503).json({
      error: 'Push notifications not configured',
      code: 'PUSH_NOT_AVAILABLE',
    });
    return;
  }

  const parseResult = subscriptionSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: 'Invalid subscription data',
      code: 'INVALID_SUBSCRIPTION',
      details: parseResult.error.format(),
    });
    return;
  }

  const subscription = parseResult.data as PushSubscription;
  const deviceId = req.device?.deviceId;

  if (!deviceId) {
    res.status(401).json({
      error: 'Authentication required',
      code: 'UNAUTHORIZED',
    });
    return;
  }

  try {
    const subscriptionId = saveSubscription(deviceId, subscription);

    res.json({
      success: true,
      subscriptionId,
    });
  } catch (error) {
    console.error('Failed to save subscription:', error);
    res.status(500).json({
      error: 'Failed to save subscription',
      code: 'SUBSCRIPTION_SAVE_FAILED',
    });
  }
});

// DELETE /api/notifications/unsubscribe
// Unsubscribe from push notifications
router.delete('/unsubscribe', (req, res): void => {
  const deviceId = req.device?.deviceId;

  if (!deviceId) {
    res.status(401).json({
      error: 'Authentication required',
      code: 'UNAUTHORIZED',
    });
    return;
  }

  try {
    removeSubscription(deviceId);

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to remove subscription:', error);
    res.status(500).json({
      error: 'Failed to remove subscription',
      code: 'SUBSCRIPTION_REMOVE_FAILED',
    });
  }
});

export default router;
