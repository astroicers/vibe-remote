import { describe, it, expect, vi } from 'vitest';

// Mock config BEFORE imports
vi.mock('../config.js', () => ({
  config: {
    CLAUDE_MODEL: 'claude-sonnet-4-20250514',
  },
}));

import { resolveModelId, MODELS, DEFAULT_MODEL_KEY } from './models.js';

describe('models', () => {
  describe('MODELS', () => {
    it('contains haiku, sonnet, and opus', () => {
      const keys = MODELS.map(m => m.key);
      expect(keys).toContain('haiku');
      expect(keys).toContain('sonnet');
      expect(keys).toContain('opus');
    });

    it('each model has required fields', () => {
      for (const model of MODELS) {
        expect(model.key).toBeTruthy();
        expect(model.name).toBeTruthy();
        expect(model.description).toBeTruthy();
        expect(model.modelId).toBeTruthy();
      }
    });
  });

  describe('DEFAULT_MODEL_KEY', () => {
    it('is sonnet', () => {
      expect(DEFAULT_MODEL_KEY).toBe('sonnet');
    });
  });

  describe('resolveModelId', () => {
    it('resolves "sonnet" to full model ID', () => {
      expect(resolveModelId('sonnet')).toBe('claude-sonnet-4-20250514');
    });

    it('resolves "opus" to full model ID', () => {
      expect(resolveModelId('opus')).toBe('claude-opus-4-20250514');
    });

    it('resolves "haiku" to full model ID', () => {
      expect(resolveModelId('haiku')).toBe('claude-haiku-4-5-20251001');
    });

    it('resolves full model ID to itself', () => {
      expect(resolveModelId('claude-sonnet-4-20250514')).toBe('claude-sonnet-4-20250514');
      expect(resolveModelId('claude-opus-4-20250514')).toBe('claude-opus-4-20250514');
      expect(resolveModelId('claude-haiku-4-5-20251001')).toBe('claude-haiku-4-5-20251001');
    });

    it('returns config default for undefined input', () => {
      expect(resolveModelId(undefined)).toBe('claude-sonnet-4-20250514');
      expect(resolveModelId()).toBe('claude-sonnet-4-20250514');
    });

    it('returns config default for empty string', () => {
      expect(resolveModelId('')).toBe('claude-sonnet-4-20250514');
    });

    it('passes through unknown strings as-is', () => {
      expect(resolveModelId('some-custom-model-id')).toBe('some-custom-model-id');
    });
  });
});
