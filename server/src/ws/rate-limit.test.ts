import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RateLimitStore, DEFAULT_RATE_LIMIT_CONFIG } from './rate-limit.js';

describe('RateLimitStore', () => {
  let store: RateLimitStore;

  beforeEach(() => {
    store = new RateLimitStore();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('checkLimit', () => {
    it('should allow requests under the limit', () => {
      const key = 'device-1';

      for (let i = 0; i < DEFAULT_RATE_LIMIT_CONFIG.maxRequests; i++) {
        expect(store.checkLimit(key)).toBe(true);
      }
    });

    it('should deny requests over the limit', () => {
      const key = 'device-1';

      // Use up all allowed requests
      for (let i = 0; i < DEFAULT_RATE_LIMIT_CONFIG.maxRequests; i++) {
        store.checkLimit(key);
      }

      // Next request should be denied
      expect(store.checkLimit(key)).toBe(false);
    });

    it('should allow requests after window expires', () => {
      const key = 'device-1';

      // Use up all allowed requests
      for (let i = 0; i < DEFAULT_RATE_LIMIT_CONFIG.maxRequests; i++) {
        store.checkLimit(key);
      }

      // Should be denied
      expect(store.checkLimit(key)).toBe(false);

      // Advance time past the window
      vi.advanceTimersByTime(DEFAULT_RATE_LIMIT_CONFIG.windowMs + 1);

      // Should be allowed again
      expect(store.checkLimit(key)).toBe(true);
    });

    it('should track different keys separately', () => {
      const key1 = 'device-1';
      const key2 = 'device-2';

      // Use up all requests for key1
      for (let i = 0; i < DEFAULT_RATE_LIMIT_CONFIG.maxRequests; i++) {
        store.checkLimit(key1);
      }

      // key1 should be denied
      expect(store.checkLimit(key1)).toBe(false);

      // key2 should still be allowed
      expect(store.checkLimit(key2)).toBe(true);
    });

    it('should use sliding window', () => {
      const key = 'device-1';
      const halfWindow = DEFAULT_RATE_LIMIT_CONFIG.windowMs / 2;

      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        store.checkLimit(key);
      }

      // Advance time by half window
      vi.advanceTimersByTime(halfWindow);

      // Make 5 more requests (should still be within limit)
      for (let i = 0; i < 5; i++) {
        expect(store.checkLimit(key)).toBe(true);
      }

      // 11th request should be denied
      expect(store.checkLimit(key)).toBe(false);

      // Advance past original 5 requests' window
      vi.advanceTimersByTime(halfWindow + 1);

      // Should be allowed again (only 5 requests in window now)
      expect(store.checkLimit(key)).toBe(true);
    });
  });

  describe('getRemainingRequests', () => {
    it('should return max requests for new key', () => {
      expect(store.getRemainingRequests('new-device')).toBe(
        DEFAULT_RATE_LIMIT_CONFIG.maxRequests
      );
    });

    it('should decrease as requests are made', () => {
      const key = 'device-1';

      store.checkLimit(key);
      expect(store.getRemainingRequests(key)).toBe(
        DEFAULT_RATE_LIMIT_CONFIG.maxRequests - 1
      );

      store.checkLimit(key);
      expect(store.getRemainingRequests(key)).toBe(
        DEFAULT_RATE_LIMIT_CONFIG.maxRequests - 2
      );
    });

    it('should return 0 when limit is reached', () => {
      const key = 'device-1';

      for (let i = 0; i < DEFAULT_RATE_LIMIT_CONFIG.maxRequests; i++) {
        store.checkLimit(key);
      }

      expect(store.getRemainingRequests(key)).toBe(0);
    });
  });

  describe('getTimeUntilReset', () => {
    it('should return 0 when under limit', () => {
      const key = 'device-1';

      store.checkLimit(key);
      expect(store.getTimeUntilReset(key)).toBe(0);
    });

    it('should return time until oldest request expires when over limit', () => {
      const key = 'device-1';

      // Make all requests at once
      for (let i = 0; i < DEFAULT_RATE_LIMIT_CONFIG.maxRequests; i++) {
        store.checkLimit(key);
      }

      const timeUntilReset = store.getTimeUntilReset(key);
      expect(timeUntilReset).toBeGreaterThan(0);
      expect(timeUntilReset).toBeLessThanOrEqual(DEFAULT_RATE_LIMIT_CONFIG.windowMs);
    });

    it('should decrease over time', () => {
      const key = 'device-1';

      for (let i = 0; i < DEFAULT_RATE_LIMIT_CONFIG.maxRequests; i++) {
        store.checkLimit(key);
      }

      const initialTime = store.getTimeUntilReset(key);

      vi.advanceTimersByTime(10000); // 10 seconds

      const laterTime = store.getTimeUntilReset(key);
      expect(laterTime).toBe(initialTime - 10000);
    });
  });

  describe('reset', () => {
    it('should clear rate limit for a specific key', () => {
      const key = 'device-1';

      // Use up all requests
      for (let i = 0; i < DEFAULT_RATE_LIMIT_CONFIG.maxRequests; i++) {
        store.checkLimit(key);
      }
      expect(store.checkLimit(key)).toBe(false);

      // Reset
      store.reset(key);

      // Should be allowed again
      expect(store.checkLimit(key)).toBe(true);
      expect(store.getRemainingRequests(key)).toBe(
        DEFAULT_RATE_LIMIT_CONFIG.maxRequests - 1
      );
    });

    it('should not affect other keys', () => {
      const key1 = 'device-1';
      const key2 = 'device-2';

      store.checkLimit(key1);
      store.checkLimit(key2);

      store.reset(key1);

      expect(store.getRemainingRequests(key1)).toBe(
        DEFAULT_RATE_LIMIT_CONFIG.maxRequests
      );
      expect(store.getRemainingRequests(key2)).toBe(
        DEFAULT_RATE_LIMIT_CONFIG.maxRequests - 1
      );
    });
  });

  describe('resetAll', () => {
    it('should clear all rate limit data', () => {
      const keys = ['device-1', 'device-2', 'device-3'];

      for (const key of keys) {
        store.checkLimit(key);
      }

      store.resetAll();

      for (const key of keys) {
        expect(store.getRemainingRequests(key)).toBe(
          DEFAULT_RATE_LIMIT_CONFIG.maxRequests
        );
      }
    });
  });

  describe('custom config', () => {
    it('should respect custom window and limit', () => {
      const customStore = new RateLimitStore({
        windowMs: 5000,
        maxRequests: 3,
      });

      const key = 'device-1';

      // Should allow 3 requests
      expect(customStore.checkLimit(key)).toBe(true);
      expect(customStore.checkLimit(key)).toBe(true);
      expect(customStore.checkLimit(key)).toBe(true);

      // 4th should be denied
      expect(customStore.checkLimit(key)).toBe(false);

      // Advance 5 seconds
      vi.advanceTimersByTime(5001);

      // Should be allowed again
      expect(customStore.checkLimit(key)).toBe(true);
    });

    it('should allow config updates', () => {
      const key = 'device-1';

      // Default: 10 requests
      for (let i = 0; i < 5; i++) {
        store.checkLimit(key);
      }
      expect(store.getRemainingRequests(key)).toBe(5);

      // Update to 3 max requests
      store.updateConfig({ maxRequests: 3 });

      // Now we're over the limit (5 > 3)
      expect(store.checkLimit(key)).toBe(false);
    });
  });
});
