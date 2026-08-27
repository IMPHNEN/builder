import { map } from 'nanostores';
import { getSetting, setSetting } from '~/lib/persistence/db';
import { db } from '~/lib/persistence/useChatHistory';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('ProviderSettings');

export const PROVIDER_SETTINGS_KEY = 'provider-config';

/**
 * Per-provider client configuration. `baseURL` enables any OpenAI-compatible or
 * Anthropic-compatible endpoint (Ollama, LM Studio, OpenRouter, proxies).
 */
export interface ProviderSetting {
  apiKey?: string;
  baseURL?: string;
}

export type ProviderSettings = Record<string, ProviderSetting>;

export interface ProviderState {
  providers: ProviderSettings;
  model: string;
}

const DEFAULT_STATE: ProviderState = {
  providers: {},
  model: 'anthropic:claude-3-5-sonnet-20240620',
};

export const providerStore = map<ProviderState>(import.meta.hot?.data.providerStore ?? DEFAULT_STATE);

if (import.meta.hot) {
  import.meta.hot.data.providerStore = providerStore.get();
}

let loaded = false;

export async function loadProviderSettings(): Promise<void> {
  if (loaded || !db) {
    return;
  }

  loaded = true;

  try {
    const persisted = await getSetting<ProviderState>(db, PROVIDER_SETTINGS_KEY);

    if (persisted) {
      providerStore.set({ ...DEFAULT_STATE, ...persisted });
    }
  } catch (error) {
    logger.error('Failed to load provider settings', error);
  }
}

function persist(state: ProviderState) {
  if (!db) {
    return;
  }

  setSetting(db, PROVIDER_SETTINGS_KEY, state).catch((error) =>
    logger.error('Failed to persist provider settings', error),
  );
}

export function setProviderSetting(provider: string, setting: ProviderSetting) {
  const state = providerStore.get();

  const providers = { ...state.providers, [provider]: { ...state.providers[provider], ...setting } };

  providerStore.setKey('providers', providers);
  persist({ ...state, providers });
}

export function setSelectedModel(model: string) {
  providerStore.setKey('model', model);
  persist({ ...providerStore.get(), model });
}

export function getSelectedModel(): string {
  return providerStore.get().model;
}

export function getProviderSettings(): ProviderSettings {
  return providerStore.get().providers;
}

export function setGitHubToken(token: string) {
  setProviderSetting('github', { apiKey: token });
}

export function getGitHubToken(): string | undefined {
  return providerStore.get().providers.github?.apiKey;
}
