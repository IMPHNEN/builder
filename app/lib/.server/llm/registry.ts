import { createAnthropic } from '@ai-sdk/anthropic';
import { experimental_createProviderRegistry, type LanguageModel } from 'ai';

export const DEFAULT_PROVIDER = 'anthropic';
export const DEFAULT_MODEL = 'claude-3-5-sonnet-20240620';

export interface ModelConfig {
  provider: string;
  model: string;
}

export interface ProviderKeys {
  anthropic?: string;
}

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

export function createProviderRegistry(keys: ProviderKeys) {
  return experimental_createProviderRegistry({
    anthropic: createAnthropic({
      apiKey: keys.anthropic,
    }),
  });
}

export function getModel(
  keys: ProviderKeys,
  modelString: string = `${DEFAULT_PROVIDER}:${DEFAULT_MODEL}`,
): LanguageModel {
  const registry = createProviderRegistry(keys);
  const { provider, model } = parseModelString(modelString);

  return registry.languageModel(`${provider}:${model}`);
}
