import { config } from '../config.js';

export interface ModelInfo {
  key: string;
  name: string;
  description: string;
  modelId: string;
}

export const MODELS: ModelInfo[] = [
  { key: 'haiku', name: 'Claude Haiku', description: 'Fastest, for simple tasks', modelId: 'claude-haiku-4-5-20251001' },
  { key: 'sonnet', name: 'Claude Sonnet', description: 'Fast, efficient for most tasks', modelId: 'claude-sonnet-4-20250514' },
  { key: 'opus', name: 'Claude Opus', description: 'Most capable, for complex tasks', modelId: 'claude-opus-4-20250514' },
];

export const DEFAULT_MODEL_KEY = 'sonnet';

/** Resolve model key or full model ID to full model ID; falls back to config default */
export function resolveModelId(keyOrId?: string): string {
  if (!keyOrId) return config.CLAUDE_MODEL;
  const byKey = MODELS.find(m => m.key === keyOrId);
  if (byKey) return byKey.modelId;
  const byId = MODELS.find(m => m.modelId === keyOrId);
  if (byId) return byId.modelId;
  return keyOrId; // passthrough unknown model IDs
}
