import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createMistral } from '@ai-sdk/mistral';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createProviderRegistry, type LanguageModel } from 'ai';

export const DEFAULT_PROVIDER = 'anthropic';
export const DEFAULT_MODEL = 'claude-3-5-sonnet-20240620';

export const SUPPORTED_PROVIDERS = [
  'anthropic',
  'claude-compatible',
  'openai',
  'openai-compatible',
  'google',
  'mistral',
] as const;

export type ProviderName = (typeof SUPPORTED_PROVIDERS)[number];

export interface ModelConfig {
  readonly provider: string;
  readonly model: string;
}

export interface ProviderConfig {
  readonly apiKey?: string;
  readonly baseURL?: string;
}

export type ProviderConfigs = Readonly<Record<string, ProviderConfig>>;

type Provider =
  | ReturnType<typeof createAnthropic>
  | ReturnType<typeof createGoogleGenerativeAI>
  | ReturnType<typeof createMistral>
  | ReturnType<typeof createOpenAICompatible>;

interface ProviderDescriptor {
  readonly name: Exclude<ProviderName, 'openai' | 'openai-compatible'>;
  readonly create: (config: ProviderConfig) => Provider;
}

const PROVIDERS = [
  { name: 'anthropic', create: (config) => createAnthropic(config) },
  { name: 'claude-compatible', create: (config) => createAnthropic(config) },
  { name: 'google', create: (config) => createGoogleGenerativeAI(config) },
  { name: 'mistral', create: (config) => createMistral(config) },
] satisfies readonly ProviderDescriptor[];

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

  if (provider === 'claude-compatible') {
    return createClaudeCompatibleModel(config, model);
  }

  if (provider === 'openai-compatible' || (provider === 'openai' && config.baseURL)) {
    return createOpenAICompatibleModel(config, model);
  }

  if (provider === 'openai') {
    return createOpenAI({ apiKey: config.apiKey }).responses(model);
  }

  return createProviderRegistryFromConfigs(configs).languageModel(`${provider}:${model}`);
}

function createClaudeCompatibleModel(config: ProviderConfig, model: string): LanguageModel {
  if (!config.baseURL) {
    throw new Error('Claude-compatible provider requires a base URL.');
  }

  return createAnthropic(config).messages(model);
}

function createOpenAICompatibleModel(config: ProviderConfig, model: string): LanguageModel {
  if (!config.baseURL) {
    throw new Error('OpenAI-compatible provider requires a base URL.');
  }

  const openaiCompatible = createOpenAICompatible({
    name: 'openai-compatible',
    baseURL: config.baseURL,
    apiKey: config.apiKey,
  });

  return openaiCompatible.chatModel(model);
}
