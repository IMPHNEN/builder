import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { listModels } from '~/lib/.server/llm/models';
import { resolveProviderConfigs } from '~/lib/.server/llm/provider-config';
import type { ProviderConfigs } from '~/lib/.server/llm/registry';
import { logLLMError } from '~/lib/.server/llm/telemetry';

interface ModelsRequestBody {
  provider: string;
  providerConfigs?: ProviderConfigs;
}

export async function action(args: ActionFunctionArgs) {
  const { request } = args;

  try {
    const { provider, providerConfigs } = await request.json<ModelsRequestBody>();

    if (!provider) {
      return Response.json({ error: 'provider is required' }, { status: 400 });
    }

    const configs = resolveProviderConfigs(providerConfigs);
    const result = await listModels(provider, configs);

    return Response.json(result);
  } catch (error) {
    logLLMError('models.list_failed', { error });

    return Response.json({ error: 'Failed to list models' }, { status: 500 });
  }
}
