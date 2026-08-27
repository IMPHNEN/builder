import { z } from 'zod';
import type { ProviderConfigs } from './registry';

export interface ProviderModels {
  provider: string;
  models: string[];
  source: 'live' | 'static';
}

/**
 * Built-in fallback catalog used when a provider does not expose a `/models`
 * endpoint or the request fails. Model names stay free-form — the registry
 * accepts any `provider:model` — so this list is a convenience, not a constraint.
 */
export const STATIC_MODELS: Record<string, string[]> = {
  anthropic: ['claude-3-5-sonnet-20240620', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
  'claude-compatible': ['claude-3-5-sonnet-20240620', 'claude-3-opus-20240229'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  'openai-compatible': ['llama3.1', 'qwen2.5-coder', 'deepseek-coder'],
  google: ['gemini-1.5-pro', 'gemini-1.5-flash'],
  mistral: ['mistral-large-latest', 'mistral-small-latest'],
};

const DEFAULT_BASE_URLS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  mistral: 'https://api.mistral.ai/v1',
};

const modelsListResponseSchema = z.object({ data: z.array(z.object({ id: z.string() })).optional() });

/**
 * Discovers models for a provider. OpenAI-compatible endpoints (including
 * Ollama, LM Studio, OpenRouter, and Mistral) expose `GET {baseURL}/models`;
 * for those we fetch the live list. Everything else falls back to the static
 * catalog. Never throws — a failed lookup returns the static list.
 */
export async function listModels(provider: string, configs: ProviderConfigs): Promise<ProviderModels> {
  const config = configs[provider];
  const staticList = STATIC_MODELS[provider] ?? [];

  const baseURL = config?.baseURL ?? DEFAULT_BASE_URLS[provider];

  const isOpenAICompatible = provider === 'openai' || provider === 'mistral' || provider === 'openai-compatible';

  if (!isOpenAICompatible || !baseURL || (!config?.apiKey && !config?.baseURL)) {
    return { provider, models: staticList, source: 'static' };
  }

  try {
    const response = await fetch(`${baseURL.replace(/\/$/, '')}/models`, {
      headers: config?.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {},
    });

    if (!response.ok) {
      return { provider, models: staticList, source: 'static' };
    }

    const body = modelsListResponseSchema.parse(await response.json());
    const models = (body.data ?? []).map((entry) => entry.id).filter(Boolean);

    return { provider, models: models.length > 0 ? models : staticList, source: models.length > 0 ? 'live' : 'static' };
  } catch {
    return { provider, models: staticList, source: 'static' };
  }
}
