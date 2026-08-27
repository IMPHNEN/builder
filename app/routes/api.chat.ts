import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  toUIMessageStream,
  type ModelMessage,
  type UIMessage,
} from 'ai';
import { MAX_RESPONSE_SEGMENTS, MAX_TOKENS } from '~/lib/.server/llm/constants';
import { CONTINUE_PROMPT } from '~/lib/.server/llm/prompts';
import { resolveProviderConfigs } from '~/lib/.server/llm/provider-config';
import type { ProviderConfigs } from '~/lib/.server/llm/registry';
import { streamText, type StreamTextOptions } from '~/lib/.server/llm/stream-text';
import { logLLMError, logLLMEvent } from '~/lib/.server/llm/telemetry';

export async function action(args: ActionFunctionArgs) {
  return chatAction(args);
}

interface ChatRequestBody {
  messages: UIMessage[];
  model?: string;
  providerConfigs?: ProviderConfigs;
}

async function chatAction({ request }: ActionFunctionArgs) {
  const { messages, model, providerConfigs } = await request.json<ChatRequestBody>();

  const resolvedConfigs = resolveProviderConfigs(providerConfigs);

  try {
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        let segment = 0;
        let currentMessages: ModelMessage[] = await convertToModelMessages(messages);

        while (true) {
          const options: StreamTextOptions = {
            toolChoice: 'none',
            modelString: model,
            providerConfigs: resolvedConfigs,
          };

          const result = await streamText(currentMessages, options);

          writer.merge(
            toUIMessageStream({
              stream: result.stream,
              sendStart: segment === 0,
              sendFinish: false,
            }),
          );

          const finishReason = await result.finishReason;

          if (finishReason !== 'length') {
            break;
          }

          segment += 1;

          if (segment >= MAX_RESPONSE_SEGMENTS) {
            logLLMError('chat.segments_exhausted', { switches: segment, maxSegments: MAX_RESPONSE_SEGMENTS });
            break;
          }

          logLLMEvent('chat.continue', { maxTokens: MAX_TOKENS, switchesLeft: MAX_RESPONSE_SEGMENTS - segment });

          const responseMessages = (await result.response).messages;

          currentMessages = [...currentMessages, ...responseMessages, { role: 'user', content: CONTINUE_PROMPT }];
        }

        writer.write({ type: 'finish' });
      },
    });

    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    logLLMError('chat.stream_failed', { error });

    throw new Response(null, {
      status: 500,
      statusText: 'Internal Server Error',
    });
  }
}
