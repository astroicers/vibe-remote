import 'dotenv/config';
import crypto from 'node:crypto';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000').transform(Number),
  HOST: z.string().default('0.0.0.0'),

  // JWT
  JWT_SECRET: z.string().min(32).default(crypto.randomBytes(32).toString('hex')),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // Claude Agent SDK
  CLAUDE_CODE_OAUTH_TOKEN: z.string().optional(), // OAuth token from `claude setup-token`
  CLAUDE_MODEL: z.string().default('claude-sonnet-4-20250514'),
  CLAUDE_PERMISSION_MODE: z
    .enum(['default', 'acceptEdits', 'bypassPermissions'])
    .default('bypassPermissions'),
  RUNNER_TIMEOUT_MS: z.string().optional().default('600000').transform(Number),  // 10 minutes
  TOOL_APPROVAL_ENABLED: z.string().optional().default('false').transform(v => v === 'true'),
  MAX_CONCURRENT_RUNNERS: z.string().optional().default('3').transform(Number),
  MAX_TURNS_CHAT: z.string().optional().default('20').transform(Number),
  MAX_TURNS_TASK: z.string().optional().default('30').transform(Number),
  TOOL_APPROVAL_TIMEOUT_MS: z.string().optional().default('120000').transform(Number),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.string().optional().default('60000').transform(Number),
  RATE_LIMIT_MAX_REQUESTS: z.string().optional().default('10').transform(Number),

  // Security
  CORS_ORIGIN: z.string().optional().default('*'),

  // AI Context
  CONTEXT_HISTORY_COUNT: z.string().optional().default('5').transform(Number),

  // Database
  DATABASE_PATH: z.string().default('./data/vibe-remote.db'),

  // Workspace path mapping (Docker volume mount: host path → container path)
  // When running in Docker, user inputs host paths (e.g. /home/ubuntu/myproject)
  // but the container sees them at a different mount point (e.g. /workspace/myproject)
  WORKSPACE_HOST_PATH: z.string().optional(),
  WORKSPACE_CONTAINER_PATH: z.string().default('/workspace'),

  // VAPID for push notifications (optional in dev)
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().email().optional(),
});

function loadConfig() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(result.error.format());
    process.exit(1);
  }

  if (!process.env.JWT_SECRET) {
    console.warn('⚠️  JWT_SECRET not set — using auto-generated secret (tokens will not survive restart)');
  }

  return result.data;
}

export const config = loadConfig();

export type Config = typeof config;
