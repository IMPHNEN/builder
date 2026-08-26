import type { WebContainer } from '@webcontainer/api';
import { describe, expect, it, vi } from 'vitest';
import { PreviewsStore } from './previews';

type PortListener = (port: number, type: 'open' | 'close', url: string) => void;

function createWebcontainerMock() {
  let listener: PortListener | undefined;

  const webcontainer = {
    on: vi.fn((event: string, cb: PortListener) => {
      if (event === 'port') {
        listener = cb;
      }
    }),
  } as unknown as WebContainer;

  return {
    webcontainer,
    emitPort: (port: number, type: 'open' | 'close', url = `http://localhost:${port}`) => listener?.(port, type, url),
  };
}

describe('PreviewsStore', () => {
  it('should add a preview when a port opens', async () => {
    const { webcontainer, emitPort } = createWebcontainerMock();
    const store = new PreviewsStore(Promise.resolve(webcontainer));

    await Promise.resolve();

    emitPort(5173, 'open');

    expect(store.previews.get()).toEqual([{ port: 5173, ready: true, baseUrl: 'http://localhost:5173' }]);
  });

  it('should remove a preview when its port closes', async () => {
    const { webcontainer, emitPort } = createWebcontainerMock();
    const store = new PreviewsStore(Promise.resolve(webcontainer));

    await Promise.resolve();

    emitPort(5173, 'open');
    emitPort(3000, 'open');
    emitPort(5173, 'close');

    expect(store.previews.get().map((p) => p.port)).toEqual([3000]);
  });

  it('should update readiness when the same port re-emits', async () => {
    const { webcontainer, emitPort } = createWebcontainerMock();
    const store = new PreviewsStore(Promise.resolve(webcontainer));

    await Promise.resolve();

    emitPort(5173, 'open');
    emitPort(5173, 'close');
    emitPort(5173, 'open');

    expect(store.previews.get()).toEqual([{ port: 5173, ready: true, baseUrl: 'http://localhost:5173' }]);
  });
});
