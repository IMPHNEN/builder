import { streamText as _streamText, convertToCoreMessages } from 'ai';
import { getProviderKeys } from '~/lib/.server/llm/api-key';
import { MAX_TOKENS } from './constants';
import { getSystemPrompt } from './prompts';
import { getModel } from './registry';

interface ToolResult<Name extends string, Args, Result> {
  toolCallId: string;
  toolName: Name;
  args: Args;
  result: Result;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolInvocations?: ToolResult<string, unknown, unknown>[];
}

export type Messages = Message[];

export type StreamingOptions = Omit<Parameters<typeof _streamText>[0], 'model'>;

export interface StreamTextOptions extends StreamingOptions {
  /**
   * `provider:model` string (e.g. `anthropic:claude-3-5-sonnet-20240620`).
   * Defaults to the Anthropic model; resolved through the provider registry.
   */
  modelString?: string;
}

export function streamText(messages: Messages, env: Env, options?: StreamTextOptions) {
  const { modelString, ...streamOptions } = options ?? {};

  return _streamText({
    model: getModel(getProviderKeys(env), modelString),
    system: getSystemPrompt(),
    maxTokens: MAX_TOKENS,
    headers: {
      'anthropic-beta': 'max-tokens-3-5-sonnet-2024-07-15',
    },
    messages: convertToCoreMessages(messages),
    ...streamOptions,
  });
}
