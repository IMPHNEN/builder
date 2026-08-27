import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { listModels } from '~/lib/.server/llm/models';
import { resolveProviderConfigs } from '~/lib/.server/llm/provider-config';
import { modelsRequestSchema } from '~/lib/.server/llm/request';
import { logLLMError } from '~/lib/.server/llm/telemetry';

export async function action(args: ActionFunctionArgs) {
  const { request } = args;

  try {
    const parsed = modelsRequestSchema.safeParse(await request.json<unknown>());

    if (!parsed.success) {
      return Response.json({ error: 'Invalid models request' }, { status: 400 });
    }

    const { provider, providerConfigs } = parsed.data;
    const configs = resolveProviderConfigs(providerConfigs);
    const result = await listModels(provider, configs);

    return Response.json(result);
  } catch (error) {
    logLLMError('models.list_failed', { error });

    return Response.json({ error: 'Failed to list models' }, { status: 500 });
  }
}
