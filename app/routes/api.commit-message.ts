import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { createTextStreamResponse, toTextStream, type ModelMessage } from 'ai';
import { resolveProviderConfigs } from '~/lib/.server/llm/provider-config';
import { commitMessageRequestSchema } from '~/lib/.server/llm/request';
import { streamText } from '~/lib/.server/llm/stream-text';
import { stripIndents } from '~/utils/stripIndent';

export async function action(args: ActionFunctionArgs) {
  const parsed = commitMessageRequestSchema.safeParse(await args.request.json<unknown>());

  if (!parsed.success) {
    return Response.json({ error: 'Invalid commit message request' }, { status: 400 });
  }

  const { diff, model, providerConfigs } = parsed.data;

  try {
    const messages: ModelMessage[] = [
      {
        role: 'user',
        content: stripIndents`
        Write a concise git commit message (conventional commits format, single line, under 72 chars) for these changes. Reply with only the commit message, nothing else.

        <changes>
        ${diff?.slice(0, 6000) ?? 'Project export'}
        </changes>
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

    throw new Response(null, { status: 500, statusText: 'Internal Server Error' });
  }
}
