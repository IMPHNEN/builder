import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { createTextStreamResponse, toTextStream, type ModelMessage } from 'ai';
import { resolveProviderConfigs } from '~/lib/.server/llm/provider-config';
import type { ProviderConfigs } from '~/lib/.server/llm/registry';
import { streamText } from '~/lib/.server/llm/stream-text';
import { stripIndents } from '~/utils/stripIndent';

interface EnhancerRequestBody {
  message: string;
  model?: string;
  providerConfigs?: ProviderConfigs;
}

export async function action(args: ActionFunctionArgs) {
  return enhancerAction(args);
}

async function enhancerAction({ request }: ActionFunctionArgs) {
  const { message, model, providerConfigs } = await request.json<EnhancerRequestBody>();

  try {
    const messages: ModelMessage[] = [
      {
        role: 'user',
        content: stripIndents`
        I want you to improve the user prompt that is wrapped in \`<original_prompt>\` tags.

        IMPORTANT: Only respond with the improved prompt and nothing else!

        <original_prompt>
          ${message}
        </original_prompt>
      `,
      },
    ];

    const result = streamText(messages, {
      modelString: model,
      providerConfigs: resolveProviderConfigs(providerConfigs),
    });

    return createTextStreamResponse({ stream: toTextStream({ stream: result.stream }) });
  } catch (error) {
    console.log(error);

    throw new Response(null, {
      status: 500,
      statusText: 'Internal Server Error',
    });
  }
}
