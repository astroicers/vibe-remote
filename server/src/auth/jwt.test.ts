import { describe, it, expect, vi } from 'vitest';
import jwt from 'jsonwebtoken';

// Mock config before importing jwt functions
vi.mock('../config.js', () => ({
  config: {
    JWT_SECRET: 'test-secret-key-minimum-32-characters-long',
    JWT_EXPIRES_IN: '7d',
  },
}));

import { signToken, verifyToken, decodeToken, JwtPayload } from './jwt.js';

describe('JWT Module', () => {
  const testPayload = {
    deviceId: 'device-123',
    deviceName: 'Test iPhone',
  };

  describe('signToken', () => {
    it('should create a valid JWT token', () => {
      const token = signToken(testPayload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT format: header.payload.signature
    });

    it('should include deviceId and deviceName in token', () => {
      const token = signToken(testPayload);
      const decoded = jwt.decode(token) as JwtPayload;

      expect(decoded.deviceId).toBe(testPayload.deviceId);
      expect(decoded.deviceName).toBe(testPayload.deviceName);
    });

    it('should set expiration time', () => {
      const token = signToken(testPayload);
      const decoded = jwt.decode(token) as JwtPayload;

      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp!).toBeGreaterThan(decoded.iat!);
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', () => {
      const token = signToken(testPayload);
      const verified = verifyToken(token);

      expect(verified.deviceId).toBe(testPayload.deviceId);
      expect(verified.deviceName).toBe(testPayload.deviceName);
    });

    it('should throw error for invalid token', () => {
      expect(() => verifyToken('invalid-token')).toThrow();
    });

    it('should throw error for tampered token', () => {
      const token = signToken(testPayload);
      const tamperedToken = token.slice(0, -5) + 'xxxxx';

      expect(() => verifyToken(tamperedToken)).toThrow();
    });

    it('should throw error for expired token', () => {
      // Create token with very short expiry
      const expiredToken = jwt.sign(
        testPayload,
        'test-secret-key-minimum-32-characters-long',
        { expiresIn: '-1s' }
      );

      expect(() => verifyToken(expiredToken)).toThrow();
    });
  });

  describe('decodeToken', () => {
    it('should decode a valid token without verification', () => {
      const token = signToken(testPayload);
      const decoded = decodeToken(token);

      expect(decoded).not.toBeNull();
      expect(decoded?.deviceId).toBe(testPayload.deviceId);
      expect(decoded?.deviceName).toBe(testPayload.deviceName);
    });

    it('should return null for invalid token format', () => {
      const decoded = decodeToken('not-a-jwt');

      // jwt.decode returns null for invalid format, not throwing
      expect(decoded).toBeNull();
    });

    it('should decode even with wrong secret (no verification)', () => {
      // Create token with different secret
      const otherToken = jwt.sign(testPayload, 'different-secret-key-also-32-chars-long');
      const decoded = decodeToken(otherToken);

      expect(decoded).not.toBeNull();
      expect(decoded?.deviceId).toBe(testPayload.deviceId);
    });
  });
});
