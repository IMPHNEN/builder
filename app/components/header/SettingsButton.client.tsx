import { useStore } from '@nanostores/react';
import { useEffect, useState } from 'react';
import { Dialog, DialogRoot, DialogTitle } from '~/components/ui/Dialog';
import { IconButton } from '~/components/ui/IconButton';
import { providerStore, setProviderSetting, setSelectedModel, type ProviderSettings } from '~/lib/stores/provider';
import { classNames } from '~/utils/classNames';

const PROVIDERS = [
  { name: 'anthropic', label: 'Anthropic', baseURLPlaceholder: 'default (api.anthropic.com)' },
  { name: 'openai', label: 'OpenAI-compatible', baseURLPlaceholder: 'http://localhost:11434/v1' },
  { name: 'google', label: 'Google', baseURLPlaceholder: 'default' },
  { name: 'mistral', label: 'Mistral', baseURLPlaceholder: 'default' },
] as const;

const FALLBACK_MODELS: Record<string, string[]> = {
  anthropic: ['claude-3-5-sonnet-20240620', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  google: ['gemini-1.5-pro', 'gemini-1.5-flash'],
  mistral: ['mistral-large-latest', 'mistral-small-latest'],
};

function providerOfModel(model: string): string {
  const separatorIndex = model.indexOf(':');

  return separatorIndex === -1 ? 'anthropic' : model.slice(0, separatorIndex);
}

function modelOfModel(model: string): string {
  const separatorIndex = model.indexOf(':');

  return separatorIndex === -1 ? model : model.slice(separatorIndex + 1);
}

export function SettingsButton() {
  const [open, setOpen] = useState(false);
  const state = useStore(providerStore);

  const activeProvider = providerOfModel(state.model);
  const activeModel = modelOfModel(state.model);

  const [modelOptions, setModelOptions] = useState<string[]>(FALLBACK_MODELS[activeProvider] ?? []);
  const [customModel, setCustomModel] = useState('');

  useEffect(() => {
    setModelOptions(FALLBACK_MODELS[activeProvider] ?? []);

    const providerConfigs: ProviderSettings = providerStore.get().providers;

    fetch('/api/models', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: activeProvider, providerConfigs }),
    })
      .then(async (response) => {
        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as { models?: string[] };

        if (data.models && data.models.length > 0) {
          setModelOptions(data.models);
        }
      })
      .catch(() => undefined);
  }, [activeProvider]);

  const selectModel = (model: string) => {
    setSelectedModel(`${activeProvider}:${model}`);
  };

  return (
    <>
      <IconButton icon="i-ph:gear-six" title="Model settings" onClick={() => setOpen(true)} />
      <DialogRoot open={open} onOpenChange={setOpen}>
        <Dialog onBackdrop={() => setOpen(false)} onClose={() => setOpen(false)} className="max-w-[560px]">
          <DialogTitle>Model settings</DialogTitle>
          <div className="max-h-[70vh] overflow-y-auto p-5 space-y-6">
            <section>
              <div className="text-bolt-elements-textSecondary text-xs font-medium mb-2 uppercase tracking-wide">
                Provider
              </div>
              <div className="flex flex-wrap gap-2">
                {PROVIDERS.map((provider) => (
                  <button
                    key={provider.name}
                    className={classNames('px-3 py-1.5 rounded-full text-sm border', {
                      'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent border-transparent':
                        activeProvider === provider.name,
                      'border-bolt-elements-borderColor text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary':
                        activeProvider !== provider.name,
                    })}
                    onClick={() => setSelectedModel(`${provider.name}:${(FALLBACK_MODELS[provider.name] ?? [''])[0]}`)}
                  >
                    {provider.label}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <div className="text-bolt-elements-textSecondary text-xs font-medium mb-2 uppercase tracking-wide">
                Model
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                {modelOptions.map((model) => (
                  <button
                    key={model}
                    className={classNames('px-3 py-1.5 rounded-md text-xs border font-mono', {
                      'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent border-transparent':
                        activeModel === model,
                      'border-bolt-elements-borderColor text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary':
                        activeModel !== model,
                    })}
                    onClick={() => selectModel(model)}
                  >
                    {model}
                  </button>
                ))}
              </div>
              <input
                value={customModel}
                onChange={(event) => setCustomModel(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && customModel.trim()) {
                    selectModel(customModel.trim());
                  }
                }}
                placeholder={`custom model name, e.g. llama3.1 (current: ${activeModel})`}
                className="w-full bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-md px-3 py-2 text-sm text-bolt-elements-textPrimary outline-none"
              />
              <div className="text-bolt-elements-textTertiary text-xs mt-1">
                Current: <span className="font-mono">{state.model}</span>
              </div>
            </section>

            <section>
              <div className="text-bolt-elements-textSecondary text-xs font-medium mb-2 uppercase tracking-wide">
                API keys & endpoints
              </div>
              <div className="space-y-4">
                {PROVIDERS.map((provider) => {
                  const setting = state.providers[provider.name] ?? {};

                  return (
                    <div key={provider.name} className="space-y-1.5">
                      <div className="text-sm text-bolt-elements-textPrimary">{provider.label}</div>
                      <input
                        type="password"
                        value={setting.apiKey ?? ''}
                        onChange={(event) => setProviderSetting(provider.name, { apiKey: event.target.value })}
                        placeholder="API key"
                        className="w-full bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-md px-3 py-2 text-sm text-bolt-elements-textPrimary outline-none"
                      />
                      <input
                        value={setting.baseURL ?? ''}
                        onChange={(event) => setProviderSetting(provider.name, { baseURL: event.target.value })}
                        placeholder={provider.baseURLPlaceholder}
                        className="w-full bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-md px-3 py-2 text-sm text-bolt-elements-textPrimary outline-none font-mono"
                      />
                    </div>
                  );
                })}
              </div>
              <div className="text-bolt-elements-textTertiary text-xs mt-3">
                Keys are stored locally in your browser (IndexedDB) and sent with each request over HTTPS. Set a base
                URL on OpenAI-compatible or Anthropic to use Ollama, LM Studio, OpenRouter, or a proxy.
              </div>
            </section>
          </div>
        </Dialog>
      </DialogRoot>
    </>
  );
}
