import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  toUIMessageStream,
  type ModelMessage,
} from 'ai';
import { getModelLimits } from '~/lib/.server/llm/constants';
import { CONTINUE_PROMPT } from '~/lib/.server/llm/prompts';
import { resolveProviderConfigs } from '~/lib/.server/llm/provider-config';
import { chatRequestSchema } from '~/lib/.server/llm/request';
import { streamText, type StreamTextOptions } from '~/lib/.server/llm/stream-text';
import { logLLMError, logLLMEvent } from '~/lib/.server/llm/telemetry';

export async function action(args: ActionFunctionArgs) {
  return chatAction(args);
}

async function chatAction({ request }: ActionFunctionArgs) {
  const body = await request.json<unknown>();
  const parsed = chatRequestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: 'Invalid chat request' }, { status: 400 });
  }

  const { messages, model, providerConfigs } = parsed.data;

  const resolvedConfigs = resolveProviderConfigs(providerConfigs);

  const limits = getModelLimits(model);

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

          if (segment >= limits.maxResponseSegments) {
            logLLMError('chat.segments_exhausted', { switches: segment, maxSegments: limits.maxResponseSegments });
            break;
          }

          logLLMEvent('chat.continue', {
            maxTokens: limits.maxTokens,
            switchesLeft: limits.maxResponseSegments - segment,
          });

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
