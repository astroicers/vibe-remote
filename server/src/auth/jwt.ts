import jwt, { type SignOptions } from 'jsonwebtoken';
import { config } from '../config.js';

export interface JwtPayload {
  deviceId: string;
  deviceName: string;
  iat?: number;
  exp?: number;
}

export function signToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  const options: SignOptions = {
    expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  };
  return jwt.sign(payload, config.JWT_SECRET, options);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, config.JWT_SECRET) as JwtPayload;
}

export function decodeToken(token: string): JwtPayload | null {
  try {
    return jwt.decode(token) as JwtPayload;
  } catch {
    return null;
  }
}

/** Tokens with less than this remaining time will be silently renewed */
export const TOKEN_RENEWAL_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Returns the remaining time in milliseconds before the token expires.
 * Returns 0 if the token is already expired or cannot be decoded.
 */
export function getTokenRemainingMs(token: string): number {
  const payload = decodeToken(token);
  if (!payload?.exp) return 0;
  return Math.max(0, payload.exp * 1000 - Date.now());
}
