import { useStore } from '@nanostores/react';
import { useEffect, useState } from 'react';
import { DialogButton } from '~/components/ui/Dialog';
import { providerStore, setProviderSetting, setSelectedModel, type ProviderSettings } from '~/lib/stores/provider';
import { classNames } from '~/utils/classNames';
import {
  modelOfModel,
  parseModelResponse,
  isAbortError,
  PROVIDERS,
  providerOfModel,
  type ProviderInfo,
} from './provider-registry';

export function ProviderRegistryPanel({ open }: { readonly open: boolean }) {
  const state = useStore(providerStore);
  const activeProvider = providerOfModel(state.model);
  const activeModel = modelOfModel(state.model);
  const selectedProvider = PROVIDERS.find((provider) => provider.name === activeProvider) ?? PROVIDERS[0];
  const [modelOptions, setModelOptions] = useState<string[]>([...selectedProvider.models]);
  const [customModel, setCustomModel] = useState('');
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | undefined>();
  const [refreshVersion, setRefreshVersion] = useState(0);
  const providerSetting = state.providers[selectedProvider.name] ?? {};
  const configured = Boolean(providerSetting.apiKey || providerSetting.baseURL);

  useEffect(() => {
    const controller = new AbortController();

    if (!open) {
      return () => controller.abort();
    }

    const fallbackModels = [...selectedProvider.models];

    setModelOptions(fallbackModels);
    setModelsLoading(true);
    setModelsError(undefined);

    const providerConfigs: ProviderSettings = providerStore.get().providers;

    fetch('/api/models', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: activeProvider, providerConfigs }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Model discovery returned ${response.status}`);
        }

        const models = parseModelResponse(await response.json());

        if (!controller.signal.aborted && models.length > 0) {
          setModelOptions(models);
        }
      })
      .catch((error: unknown) => {
        if (!isAbortError(error)) {
          setModelsError('Live discovery unavailable; showing the built-in catalog.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setModelsLoading(false);
        }
      });

    return () => controller.abort();
  }, [activeProvider, open, refreshVersion, selectedProvider]);

  const selectProvider = (provider: ProviderInfo) => {
    const nextModel = provider.models[0];

    if (nextModel) {
      setSelectedModel(`${provider.name}:${nextModel}`);
    }
  };

  const selectModel = (model: string) => {
    setSelectedModel(`${selectedProvider.name}:${model}`);
    setCustomModel('');
  };

  return (
    <div className="max-h-[75vh] overflow-y-auto p-5 space-y-6">
      <section aria-labelledby="provider-registry-heading">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h2 id="provider-registry-heading" className="text-sm font-medium text-bolt-elements-textPrimary">
              Provider registry
            </h2>
            <p className="mt-1 text-xs text-bolt-elements-textTertiary">
              Choose a native provider or point a compatibility adapter at your own endpoint.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-bolt-elements-item-backgroundAccent px-2 py-1 text-[10px] uppercase tracking-wide text-bolt-elements-item-contentAccent">
            {configured ? 'Configured' : 'Needs setup'}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {PROVIDERS.map((provider) => {
            const selected = provider.name === activeProvider;
            const hasConfig = Boolean(
              state.providers[provider.name]?.apiKey || state.providers[provider.name]?.baseURL,
            );

            return (
              <button
                key={provider.name}
                type="button"
                aria-pressed={selected}
                className={classNames(
                  'rounded-lg border p-3 text-left transition-theme focus:outline-none focus:ring-1 focus:ring-bolt-elements-item-contentAccent',
                  {
                    'border-bolt-elements-item-contentAccent bg-bolt-elements-item-backgroundAccent': selected,
                    'border-bolt-elements-borderColor hover:border-bolt-elements-item-contentAccent': !selected,
                  },
                )}
                onClick={() => selectProvider(provider)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-bolt-elements-textPrimary">{provider.label}</span>
                  <span className="text-[10px] uppercase tracking-wide text-bolt-elements-textTertiary">
                    {provider.protocol}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-4 text-bolt-elements-textTertiary">{provider.description}</p>
                <span className="mt-2 inline-flex items-center gap-1 text-[11px] text-bolt-elements-textSecondary">
                  <span
                    className={classNames('h-1.5 w-1.5 rounded-full', hasConfig ? 'bg-green-500' : 'bg-gray-400')}
                  />
                  {hasConfig ? 'Ready' : 'Not configured'}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="model-registry-heading">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h2 id="model-registry-heading" className="text-sm font-medium text-bolt-elements-textPrimary">
              Models
            </h2>
            <p className="mt-1 text-xs text-bolt-elements-textTertiary">
              Active provider: <span className="font-mono">{selectedProvider.name}</span>
            </p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-bolt-elements-borderColor px-2.5 py-1.5 text-xs text-bolt-elements-textSecondary enabled:hover:text-bolt-elements-textPrimary disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => setRefreshVersion((version) => version + 1)}
            disabled={modelsLoading}
          >
            <span className={classNames('i-ph:arrows-clockwise', { 'animate-spin': modelsLoading })} />
            {modelsLoading ? 'Refreshing' : 'Refresh models'}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {modelOptions.map((model) => (
            <button
              key={model}
              type="button"
              aria-pressed={activeProvider === selectedProvider.name && activeModel === model}
              className={classNames('rounded-md border px-3 py-1.5 text-xs font-mono transition-theme', {
                'border-transparent bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent':
                  activeProvider === selectedProvider.name && activeModel === model,
                'border-bolt-elements-borderColor text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary':
                  activeProvider !== selectedProvider.name || activeModel !== model,
              })}
              onClick={() => selectModel(model)}
            >
              {model}
            </button>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={customModel}
            aria-label="Custom model name"
            onChange={(event) => setCustomModel(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && customModel.trim()) {
                selectModel(customModel.trim());
              }
            }}
            placeholder={`Custom model name (current: ${activeModel})`}
            className="min-w-0 flex-1 rounded-md border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 px-3 py-2 text-sm text-bolt-elements-textPrimary outline-none focus:border-bolt-elements-item-contentAccent"
          />
          <DialogButton type="secondary" onClick={() => selectModel(customModel.trim())} disabled={!customModel.trim()}>
            Use model
          </DialogButton>
        </div>
        <div className="mt-2 min-h-4 text-xs text-bolt-elements-textTertiary" aria-live="polite">
          {modelsLoading && 'Querying the provider model catalog...'}
          {!modelsLoading && modelsError}
        </div>
      </section>

      <section aria-labelledby="provider-config-heading">
        <div className="mb-3">
          <h2 id="provider-config-heading" className="text-sm font-medium text-bolt-elements-textPrimary">
            {selectedProvider.label} configuration
          </h2>
          <p className="mt-1 text-xs text-bolt-elements-textTertiary">
            Credentials stay in this browser and are sent only when making a model request.
          </p>
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="provider-api-key" className="text-xs text-bolt-elements-textSecondary">
              API key or OAuth token
            </label>
            <input
              id="provider-api-key"
              type="password"
              autoComplete="off"
              value={providerSetting.apiKey ?? ''}
              onChange={(event) => setProviderSetting(selectedProvider.name, { apiKey: event.target.value })}
              placeholder="Stored locally in IndexedDB"
              className="w-full rounded-md border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 px-3 py-2 text-sm text-bolt-elements-textPrimary outline-none focus:border-bolt-elements-item-contentAccent"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="provider-base-url" className="text-xs text-bolt-elements-textSecondary">
              Base URL
            </label>
            <input
              id="provider-base-url"
              type="url"
              value={providerSetting.baseURL ?? ''}
              onChange={(event) => setProviderSetting(selectedProvider.name, { baseURL: event.target.value })}
              placeholder={selectedProvider.baseURLPlaceholder}
              className="w-full rounded-md border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 px-3 py-2 text-sm font-mono text-bolt-elements-textPrimary outline-none focus:border-bolt-elements-item-contentAccent"
            />
          </div>
        </div>
        <p className="mt-3 text-xs leading-5 text-bolt-elements-textTertiary">
          {selectedProvider.protocol === 'openai-compatible'
            ? 'The OpenAI-compatible adapter calls the chat completions shape at this URL.'
            : selectedProvider.protocol === 'claude-compatible'
              ? 'The Claude-compatible adapter calls the Anthropic Messages shape at this URL.'
              : selectedProvider.name === 'openai' && providerSetting.baseURL
                ? 'A custom OpenAI URL uses the chat completions compatibility adapter.'
                : 'Leave Base URL empty to use the native provider endpoint.'}
        </p>
      </section>
    </div>
  );
}
