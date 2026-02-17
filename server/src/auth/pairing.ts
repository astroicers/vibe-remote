import QRCode from 'qrcode';
import { randomBytes } from 'crypto';
import { getDb, generateId } from '../db/index.js';
import { signToken } from './jwt.js';
import { config } from '../config.js';

interface PairingSession {
  code: string;
  expiresAt: number;
  serverUrl: string;
}

// In-memory store for active pairing sessions
// In production, this should be Redis or similar
const pairingSessions = new Map<string, PairingSession>();

// Clean up expired sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [code, session] of pairingSessions) {
    if (session.expiresAt < now) {
      pairingSessions.delete(code);
    }
  }
}, 60000); // Every minute

export function createPairingSession(serverUrl: string): PairingSession {
  // Generate a 6-character alphanumeric code
  const code = randomBytes(3).toString('hex').toUpperCase();

  const session: PairingSession = {
    code,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
    serverUrl,
  };

  pairingSessions.set(code, session);

  return session;
}

export async function generatePairingQR(session: PairingSession): Promise<string> {
  const pairingUrl = `${session.serverUrl}/api/auth/pair?code=${session.code}`;

  // Generate QR code as data URL
  const qrDataUrl = await QRCode.toDataURL(pairingUrl, {
    width: 256,
    margin: 2,
    color: {
      dark: '#e4e4e7', // text-primary
      light: '#000000', // bg-primary (OLED black)
    },
  });

  return qrDataUrl;
}

export interface PairResult {
  success: boolean;
  token?: string;
  deviceId?: string;
  error?: string;
}

export function completePairing(code: string, deviceName: string): PairResult {
  const session = pairingSessions.get(code);

  if (!session) {
    return { success: false, error: 'Invalid or expired pairing code' };
  }

  if (session.expiresAt < Date.now()) {
    pairingSessions.delete(code);
    return { success: false, error: 'Pairing code has expired' };
  }

  // Create device record
  const db = getDb();
  const deviceId = generateId('dev');

  db.prepare(`
    INSERT INTO devices (id, name, last_seen_at)
    VALUES (?, ?, datetime('now'))
  `).run(deviceId, deviceName);

  // Generate JWT
  const token = signToken({ deviceId, deviceName });

  // Remove used pairing session
  pairingSessions.delete(code);

  return {
    success: true,
    token,
    deviceId,
  };
}

export function getPairingSession(code: string): PairingSession | undefined {
  const session = pairingSessions.get(code);

  if (session && session.expiresAt < Date.now()) {
    pairingSessions.delete(code);
    return undefined;
  }

  return session;
}

// For development: quick pairing without QR
export function devQuickPair(deviceName: string): { token: string; deviceId: string } {
  if (config.NODE_ENV !== 'development') {
    throw new Error('Quick pairing is only available in development mode');
  }

  const db = getDb();
  const deviceId = generateId('dev');

  db.prepare(`
    INSERT INTO devices (id, name, last_seen_at)
    VALUES (?, ?, datetime('now'))
  `).run(deviceId, deviceName);

  const token = signToken({ deviceId, deviceName });

  return { token, deviceId };
}
