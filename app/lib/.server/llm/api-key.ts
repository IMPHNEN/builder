import { env } from 'node:process';
import type { ProviderKeys } from './registry';

/**
 * Server-only: reads provider API keys from Cloudflare bindings, falling back to
 * `process.env` in local development where bindings are not populated.
 */
export function getProviderKeys(cloudflareEnv: Env): ProviderKeys {
  return {
    anthropic: env.ANTHROPIC_API_KEY || cloudflareEnv.ANTHROPIC_API_KEY,
  };
}
