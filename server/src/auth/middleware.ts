import type { Request, Response, NextFunction } from 'express';
import { verifyToken, signToken, getTokenRemainingMs, TOKEN_RENEWAL_THRESHOLD_MS, type JwtPayload } from './jwt.js';
import { getDb } from '../db/index.js';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      device?: JwtPayload;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Missing or invalid authorization header',
      code: 'UNAUTHORIZED',
    });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyToken(token);

    // Verify device exists in database
    const db = getDb();
    const device = db.prepare('SELECT id FROM devices WHERE id = ?').get(payload.deviceId);

    if (!device) {
      res.status(401).json({
        error: 'Device not found or has been revoked',
        code: 'DEVICE_REVOKED',
      });
      return;
    }

    // Update last seen
    db.prepare("UPDATE devices SET last_seen_at = datetime('now') WHERE id = ?")
      .run(payload.deviceId);

    // Silent token renewal: if token is valid but nearing expiry, issue a new one
    const remainingMs = getTokenRemainingMs(token);
    if (remainingMs > 0 && remainingMs < TOKEN_RENEWAL_THRESHOLD_MS) {
      res.setHeader('X-Renewed-Token', signToken({
        deviceId: payload.deviceId,
        deviceName: payload.deviceName,
      }));
    }

    req.device = payload;
    next();
  } catch (error) {
    if (error instanceof Error && error.name === 'TokenExpiredError') {
      res.status(401).json({
        error: 'Token has expired',
        code: 'TOKEN_EXPIRED',
      });
      return;
    }

    res.status(401).json({
      error: 'Invalid token',
      code: 'INVALID_TOKEN',
    });
  }
}

// Optional auth - doesn't fail if no token, but sets req.device if valid
export function optionalAuthMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyToken(token);
    req.device = payload;
  } catch {
    // Ignore invalid tokens in optional auth
  }

  next();
}
