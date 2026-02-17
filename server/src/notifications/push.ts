// Push Notification Service using web-push

import webpush from 'web-push';
import { config } from '../config';
import { getDb } from '../db';

// VAPID keys for web push
interface VapidKeys {
  publicKey: string;
  privateKey: string;
  subject: string;
}

// Initialize web-push with VAPID keys
function initializeWebPush(): VapidKeys | null {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = config;

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
    console.warn('⚠️  VAPID keys not configured - push notifications disabled');
    return null;
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  return {
    publicKey: VAPID_PUBLIC_KEY,
    privateKey: VAPID_PRIVATE_KEY,
    subject: VAPID_SUBJECT,
  };
}

const vapidKeys = initializeWebPush();

// Push subscription from client
export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

// Notification payload
export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

// Check if push notifications are available
export function isPushAvailable(): boolean {
  return vapidKeys !== null;
}

// Get VAPID public key for client
export function getVapidPublicKey(): string | null {
  return vapidKeys?.publicKey ?? null;
}

// Generate unique ID
function generateId(): string {
  return `sub_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

// Save subscription to database
export function saveSubscription(deviceId: string, subscription: PushSubscription): string {
  const db = getDb();
  const id = generateId();

  // Remove existing subscription for this endpoint (if any)
  db.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ?`).run(subscription.endpoint);

  // Insert new subscription
  db.prepare(
    `INSERT INTO push_subscriptions (id, device_id, endpoint, keys) VALUES (?, ?, ?, ?)`
  ).run(id, deviceId, subscription.endpoint, JSON.stringify(subscription.keys));

  return id;
}

// Remove subscription from database
export function removeSubscription(deviceId: string): void {
  const db = getDb();
  db.prepare(`DELETE FROM push_subscriptions WHERE device_id = ?`).run(deviceId);
}

// Remove subscription by endpoint
export function removeSubscriptionByEndpoint(endpoint: string): void {
  const db = getDb();
  db.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ?`).run(endpoint);
}

// Get subscription for a device
export function getSubscription(deviceId: string): PushSubscription | null {
  const db = getDb();
  const row = db
    .prepare(`SELECT endpoint, keys FROM push_subscriptions WHERE device_id = ? ORDER BY created_at DESC LIMIT 1`)
    .get(deviceId) as { endpoint: string; keys: string } | undefined;

  if (!row) return null;

  try {
    return {
      endpoint: row.endpoint,
      keys: JSON.parse(row.keys),
    };
  } catch {
    return null;
  }
}

// Get all subscriptions for a device (a device can have multiple browsers)
export function getAllSubscriptions(deviceId: string): PushSubscription[] {
  const db = getDb();
  const rows = db
    .prepare(`SELECT endpoint, keys FROM push_subscriptions WHERE device_id = ?`)
    .all(deviceId) as Array<{ endpoint: string; keys: string }>;

  return rows
    .map((row) => {
      try {
        return {
          endpoint: row.endpoint,
          keys: JSON.parse(row.keys),
        };
      } catch {
        return null;
      }
    })
    .filter((sub): sub is PushSubscription => sub !== null);
}

// Send notification to a single subscription
async function sendToSubscription(
  subscription: PushSubscription,
  payload: NotificationPayload
): Promise<boolean> {
  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify(payload),
      {
        TTL: 60 * 60, // 1 hour
        urgency: 'normal',
      }
    );
    return true;
  } catch (error) {
    console.error('Failed to send push notification:', error);

    // If subscription is invalid, remove it
    if (error instanceof webpush.WebPushError) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        removeSubscriptionByEndpoint(subscription.endpoint);
      }
    }

    return false;
  }
}

// Send notification to a device (all subscriptions)
export async function sendNotification(
  deviceId: string,
  payload: NotificationPayload
): Promise<boolean> {
  if (!isPushAvailable()) {
    console.warn('Push notifications not available');
    return false;
  }

  const subscriptions = getAllSubscriptions(deviceId);
  if (subscriptions.length === 0) {
    console.warn(`No push subscriptions for device ${deviceId}`);
    return false;
  }

  const results = await Promise.all(
    subscriptions.map((sub) => sendToSubscription(sub, payload))
  );

  return results.some((success) => success);
}

// Send notification to all subscribed devices
export async function sendToAllDevices(
  payload: NotificationPayload
): Promise<number> {
  if (!isPushAvailable()) return 0;

  const db = getDb();
  // Get all unique subscriptions
  const subscriptions = db
    .prepare(`SELECT endpoint, keys FROM push_subscriptions`)
    .all() as Array<{ endpoint: string; keys: string }>;

  let successCount = 0;
  for (const row of subscriptions) {
    try {
      const subscription: PushSubscription = {
        endpoint: row.endpoint,
        keys: JSON.parse(row.keys),
      };
      const success = await sendToSubscription(subscription, payload);
      if (success) successCount++;
    } catch {
      // Skip invalid subscriptions
    }
  }

  return successCount;
}

// Predefined notification types
export const notifications = {
  taskCompleted: (taskName: string, success: boolean) => ({
    title: success ? 'Task Completed' : 'Task Failed',
    body: taskName,
    icon: '/icons/icon-192.svg',
    badge: '/icons/icon-192.svg',
    tag: 'task-status',
    data: { type: 'task', success },
    actions: success
      ? [
          { action: 'view-diff', title: 'View Diff' },
          { action: 'dismiss', title: 'Dismiss' },
        ]
      : [
          { action: 'view-error', title: 'View Error' },
          { action: 'dismiss', title: 'Dismiss' },
        ],
  }),

  diffReady: (filesChanged: number) => ({
    title: 'Changes Ready for Review',
    body: `${filesChanged} file${filesChanged === 1 ? '' : 's'} modified`,
    icon: '/icons/icon-192.svg',
    badge: '/icons/icon-192.svg',
    tag: 'diff-review',
    data: { type: 'diff' },
    actions: [
      { action: 'review', title: 'Review Now' },
      { action: 'later', title: 'Later' },
    ],
  }),

  gitPushComplete: (branch: string, commits: number) => ({
    title: 'Push Complete',
    body: `${commits} commit${commits === 1 ? '' : 's'} pushed to ${branch}`,
    icon: '/icons/icon-192.svg',
    badge: '/icons/icon-192.svg',
    tag: 'git-push',
    data: { type: 'git', action: 'push' },
  }),

  aiResponse: (preview: string) => ({
    title: 'AI Response',
    body: preview.slice(0, 100) + (preview.length > 100 ? '...' : ''),
    icon: '/icons/icon-192.svg',
    badge: '/icons/icon-192.svg',
    tag: 'ai-response',
    data: { type: 'ai' },
    actions: [{ action: 'open', title: 'View Response' }],
  }),
};
