import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000').transform(Number),
  HOST: z.string().default('0.0.0.0'),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // Claude Agent SDK
  CLAUDE_CODE_OAUTH_TOKEN: z.string().optional(), // OAuth token from `claude setup-token`
  CLAUDE_MODEL: z.string().default('claude-sonnet-4-20250514'),
  CLAUDE_PERMISSION_MODE: z
    .enum(['default', 'acceptEdits', 'bypassPermissions'])
    .default('bypassPermissions'),

  // Database
  DATABASE_PATH: z.string().default('./data/vibe-remote.db'),

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

  return result.data;
}

export const config = loadConfig();

export type Config = typeof config;
