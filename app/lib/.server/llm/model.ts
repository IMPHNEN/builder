import { createAnthropic } from '@ai-sdk/anthropic';
import type { LanguageModel } from 'ai';
import { DEFAULT_MODEL } from './registry';

// kept for backwards compatibility; prefer `getModel` from `./registry` for provider selection
export function getAnthropicModel(apiKey: string): LanguageModel {
  const anthropic = createAnthropic({
    apiKey,
  });

  return anthropic(DEFAULT_MODEL);
}
