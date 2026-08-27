import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createMistral } from '@ai-sdk/mistral';
import { createOpenAI } from '@ai-sdk/openai';
import { createProviderRegistry, type LanguageModel } from 'ai';

export const DEFAULT_PROVIDER = 'anthropic';
export const DEFAULT_MODEL = 'claude-3-5-sonnet-20240620';

export interface ModelConfig {
  provider: string;
  model: string;
}

/**
 * Resolved configuration for a single provider. `baseURL` enables any
 * OpenAI-compatible or Anthropic-compatible endpoint (Ollama, LM Studio,
 * OpenRouter, self-hosted proxies) without a dedicated provider package.
 */
export interface ProviderConfig {
  apiKey?: string;
  baseURL?: string;
}

export type ProviderConfigs = Record<string, ProviderConfig>;

type Provider = ReturnType<typeof createAnthropic>;

interface ProviderDescriptor {
  name: string;
  create: (config: ProviderConfig) => Provider;
}

const PROVIDERS: ProviderDescriptor[] = [
  { name: 'anthropic', create: (c) => createAnthropic({ apiKey: c.apiKey, baseURL: c.baseURL }) as Provider },
  { name: 'openai', create: (c) => createOpenAI({ apiKey: c.apiKey, baseURL: c.baseURL }) as unknown as Provider },
  {
    name: 'google',
    create: (c) => createGoogleGenerativeAI({ apiKey: c.apiKey, baseURL: c.baseURL }) as unknown as Provider,
  },
  { name: 'mistral', create: (c) => createMistral({ apiKey: c.apiKey, baseURL: c.baseURL }) as unknown as Provider },
];

export function parseModelString(modelString: string): ModelConfig {
  const separatorIndex = modelString.indexOf(':');

  if (separatorIndex === -1) {
    return { provider: DEFAULT_PROVIDER, model: modelString };
  }

  return {
    provider: modelString.slice(0, separatorIndex),
    model: modelString.slice(separatorIndex + 1),
  };
}

export function createProviderRegistryFromConfigs(configs: ProviderConfigs) {
  const providers: Record<string, Provider> = {};

  for (const descriptor of PROVIDERS) {
    const config = configs[descriptor.name];

    if (config?.apiKey || config?.baseURL) {
      providers[descriptor.name] = descriptor.create(config);
    }
  }

  return createProviderRegistry(providers);
}

/**
 * Resolves a language model for `provider:model`. OpenAI routes to the Responses
 * API against the real OpenAI endpoint, and to the chat-completions API (with a
 * max-token parameter shim) against compatible endpoints.
 */
export function getModel(
  configs: ProviderConfigs,
  modelString: string = `${DEFAULT_PROVIDER}:${DEFAULT_MODEL}`,
): LanguageModel {
  const { provider, model } = parseModelString(modelString);
  const config = configs[provider];

  if (!config?.apiKey && !config?.baseURL) {
    throw new Error(
      `No API key or endpoint configured for provider "${provider}". Open Model settings and add a key or base URL.`,
    );
  }

  if (provider === 'openai') {
    if (config.baseURL) {
      /**
       * Compatible endpoint (Ollama, LM Studio, OpenRouter, proxies). These
       * implement the chat-completions shape, not the Responses API, and many
       * newer models reject `max_tokens`. Use the chat model and translate the
       * parameter to `max_completion_tokens` on the way out.
       */
      const openai = createOpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
        fetch: translateMaxTokensFetch,
      });

      return openai.chat(model);
    }

    return createOpenAI({ apiKey: config.apiKey }).responses(model);
  }

  return createProviderRegistryFromConfigs(configs).languageModel(`${provider}:${model}`);
}

const MAX_TOKEN_PARAM_KEYS = ['max_tokens', 'max_completion_tokens', 'max_output_tokens'] as const;

/**
 * Wraps fetch to rewrite any max-token parameter in the request body to
 * `max_completion_tokens`, which OpenAI's newer chat models require. Leaves the
 * URL, headers, and streaming behavior untouched.
 */
const translateMaxTokensFetch: typeof fetch = async (input, init) => {
  if (!init?.body || typeof init.body !== 'string') {
    return fetch(input, init);
  }

  let payload: Record<string, unknown>;

  try {
    payload = JSON.parse(init.body);
  } catch {
    return fetch(input, init);
  }

  let maxTokens: unknown;

  for (const key of MAX_TOKEN_PARAM_KEYS) {
    if (payload[key] !== undefined) {
      maxTokens = payload[key];
      delete payload[key];
    }
  }

  if (maxTokens !== undefined) {
    payload.max_completion_tokens = maxTokens;
  }

  return fetch(input, { ...init, body: JSON.stringify(payload) });
};
