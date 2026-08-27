import { z } from 'zod';
import { SUPPORTED_PROVIDERS, type ProviderConfigs } from './registry';

const LLM_PROVIDER_NAMES = new Set<string>(SUPPORTED_PROVIDERS);

const optionalText = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().min(1).optional(),
);

const optionalURL = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().url().optional(),
);

const providerConfigSchema = z.object({
  apiKey: optionalText,
  baseURL: optionalURL,
});

export function resolveProviderConfigs(client: unknown): ProviderConfigs {
  if (!isRecord(client)) {
    return {};
  }

  const resolved: Record<string, ProviderConfigs[string]> = {};

  for (const [name, value] of Object.entries(client)) {
    if (!LLM_PROVIDER_NAMES.has(name)) {
      continue;
    }

    const parsed = providerConfigSchema.safeParse(value);

    if (parsed.success && (parsed.data.apiKey || parsed.data.baseURL)) {
      resolved[name] = parsed.data;
    }
  }

  return resolved;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
