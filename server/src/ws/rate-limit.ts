// Rate Limiting Module
// Extracted from chat-handler for testability

import { config } from '../config.js';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  windowMs: 60000, // 1 minute
  maxRequests: 10, // 10 messages per minute
};

export class RateLimitStore {
  private timestamps = new Map<string, number[]>();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig = DEFAULT_RATE_LIMIT_CONFIG) {
    this.config = config;
  }

  /**
   * Check if a request should be allowed based on rate limiting.
   * @param key - Identifier for rate limiting (e.g., deviceId, userId)
   * @returns true if request is allowed, false if rate limit exceeded
   */
  checkLimit(key: string): boolean {
    const now = Date.now();
    const timestamps = this.timestamps.get(key) || [];

    // Remove old timestamps outside the window
    const recentTimestamps = timestamps.filter(
      (t) => now - t < this.config.windowMs
    );

    if (recentTimestamps.length >= this.config.maxRequests) {
      return false;
    }

    recentTimestamps.push(now);
    this.timestamps.set(key, recentTimestamps);
    return true;
  }

  /**
   * Get the number of remaining requests for a key.
   */
  getRemainingRequests(key: string): number {
    const now = Date.now();
    const timestamps = this.timestamps.get(key) || [];
    const recentTimestamps = timestamps.filter(
      (t) => now - t < this.config.windowMs
    );
    return Math.max(0, this.config.maxRequests - recentTimestamps.length);
  }

  /**
   * Get time until next request is allowed (in ms).
   * Returns 0 if request is currently allowed.
   */
  getTimeUntilReset(key: string): number {
    const now = Date.now();
    const timestamps = this.timestamps.get(key) || [];
    const recentTimestamps = timestamps.filter(
      (t) => now - t < this.config.windowMs
    );

    if (recentTimestamps.length < this.config.maxRequests) {
      return 0;
    }

    // Find the oldest timestamp in the window
    const oldestTimestamp = Math.min(...recentTimestamps);
    return this.config.windowMs - (now - oldestTimestamp);
  }

  /**
   * Clear all rate limit data for a key.
   */
  reset(key: string): void {
    this.timestamps.delete(key);
  }

  /**
   * Clear all rate limit data.
   */
  resetAll(): void {
    this.timestamps.clear();
  }

  /**
   * Get the current config.
   */
  getConfig(): RateLimitConfig {
    return { ...this.config };
  }

  /**
   * Update the config (for runtime configuration changes).
   */
  updateConfig(config: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Singleton instance for app-wide use (uses env config values)
export const rateLimitStore = new RateLimitStore({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  maxRequests: config.RATE_LIMIT_MAX_REQUESTS,
});
