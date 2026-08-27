import { afterEach, describe, expect, it, vi } from 'vitest';
import { listModels, STATIC_MODELS } from './models';

describe('listModels', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return the static catalog for anthropic without fetching', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const result = await listModels('anthropic', {});

    expect(result.source).toBe('static');
    expect(result.models).toEqual(STATIC_MODELS.anthropic);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('should fetch the live model list from an OpenAI-compatible baseURL', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ data: [{ id: 'llama3.1' }, { id: 'qwen2.5' }] }),
      })),
    );

    const result = await listModels('openai', { openai: { baseURL: 'http://localhost:11434/v1' } });

    expect(result.source).toBe('live');
    expect(result.models).toEqual(['llama3.1', 'qwen2.5']);
  });

  it('should strip a trailing slash from the baseURL before requesting', async () => {
    const fetchSpy = vi.fn(async () => ({ ok: true, json: async () => ({ data: [] }) }));
    vi.stubGlobal('fetch', fetchSpy);

    await listModels('openai', { openai: { baseURL: 'http://localhost:11434/v1/' } });

    expect(fetchSpy).toHaveBeenCalledWith('http://localhost:11434/v1/models', expect.anything());
  });

  it('should fall back to the static list when the request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, json: async () => ({}) })),
    );

    const result = await listModels('openai', { openai: { baseURL: 'http://localhost:1/v1' } });

    expect(result.source).toBe('static');
    expect(result.models).toEqual(STATIC_MODELS.openai);
  });

  it('should fall back to the static list when fetch throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('connection refused');
      }),
    );

    const result = await listModels('openai', { openai: { baseURL: 'http://localhost:1/v1' } });

    expect(result.source).toBe('static');
  });
});
