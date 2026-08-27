import type { ProviderConfigs } from './registry';

/**
 * Normalizes client-supplied provider configuration. The browser is the only
 * source of API keys and endpoints (persisted in IndexedDB); there is no
 * environment/.env fallback. Empty entries are dropped so they never register a
 * provider without credentials.
 */
export function resolveProviderConfigs(client: ProviderConfigs | undefined): ProviderConfigs {
  const resolved: ProviderConfigs = {};

  if (!client) {
    return resolved;
  }

  for (const [name, config] of Object.entries(client)) {
    if (config?.apiKey || config?.baseURL) {
      resolved[name] = { apiKey: config.apiKey, baseURL: config.baseURL };
    }
  }

  return resolved;
}
