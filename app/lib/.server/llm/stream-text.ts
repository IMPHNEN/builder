import { streamText as _streamText, type ModelMessage } from 'ai';
import { getModelLimits } from './constants';
import { getSystemPrompt } from './prompts';
import { getModel, type ProviderConfigs } from './registry';

type BaseStreamOptions = Omit<Parameters<typeof _streamText>[0], 'model' | 'messages' | 'system' | 'maxOutputTokens'>;

export interface StreamTextOptions extends BaseStreamOptions {
  /**
   * Free-form `provider:model` string (e.g. `anthropic:claude-3-5-sonnet-20240620`,
   * `openai:gpt-5`). OpenAI-compatible endpoints route through the Responses API.
   */
  modelString?: string;

  /**
   * Client-supplied provider configuration (persisted in the browser). This is the
   * only source of API keys and endpoints — there is no environment fallback.
   */
  providerConfigs: ProviderConfigs;
}

export function streamText(messages: ModelMessage[], options: StreamTextOptions) {
  const { modelString, providerConfigs, ...streamOptions } = options;

  return _streamText({
    model: getModel(providerConfigs, modelString),
    system: getSystemPrompt(),
    maxOutputTokens: getModelLimits(modelString).maxTokens,
    messages,
    ...streamOptions,
  } as Parameters<typeof _streamText>[0]);
}
