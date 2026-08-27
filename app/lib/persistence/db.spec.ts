import { indexedDB } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  deleteByUrlId,
  exportChats,
  getAll,
  getSetting,
  importChats,
  setMessages,
  setSetting,
  updateChatDescription,
} from './db';

// exercises the real IndexedDB implementation against an in-memory shim
describe('db (IndexedDB via fake-indexeddb)', () => {
  beforeEach(() => {
    (globalThis as { indexedDB?: IDBFactory }).indexedDB = indexedDB;
  });

  async function openTestDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(`test-${Math.random()}`, 1);

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains('chats')) {
          const store = db.createObjectStore('chats', { keyPath: 'id' });
          store.createIndex('id', 'id', { unique: true });
          store.createIndex('urlId', 'urlId', { unique: true });
        }

        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  it('should return chats sorted by most recent first', async () => {
    const db = await openTestDb();

    await setMessages(db, '1', [], 'a', 'first');
    await setMessages(db, '2', [], 'b', 'second');

    // force distinct timestamps so ordering is deterministic
    await new Promise((resolve) => setTimeout(resolve, 5));
    await setMessages(db, '3', [], 'c', 'third');

    const all = await getAll(db);

    expect(all[0].id).toBe('3');
    expect(all.map((c) => c.timestamp)).toEqual([...all.map((c) => c.timestamp)].sort().reverse());
  });

  it('should rename a chat and preserve messages', async () => {
    const db = await openTestDb();

    await setMessages(db, '1', [{ role: 'user', content: 'hi' } as never], 'a', 'old');
    await updateChatDescription(db, '1', 'renamed');

    const all = await getAll(db);

    expect(all[0].description).toBe('renamed');
    expect(all[0].messages).toHaveLength(1);
  });

  it('should delete a chat by urlId', async () => {
    const db = await openTestDb();

    await setMessages(db, '1', [], 'keep', 'keep');
    await setMessages(db, '2', [], 'drop', 'drop');

    await deleteByUrlId(db, 'drop');

    const all = await getAll(db);

    expect(all.map((c) => c.urlId)).toEqual(['keep']);
  });

  it('should export chats with a versioned envelope', async () => {
    const db = await openTestDb();

    await setMessages(db, '1', [], 'a', 'first');

    const exported = await exportChats(db);

    expect(exported.version).toBe(1);
    expect(exported.chats).toHaveLength(1);
    expect(exported.chats[0].description).toBe('first');
    expect(typeof exported.exportedAt).toBe('string');
  });

  it('should import an exported payload with fresh ids and urlIds', async () => {
    const db = await openTestDb();

    await setMessages(
      db,
      '1',
      [{ id: 'm1', role: 'user', parts: [{ type: 'text', text: 'hi' }] } as never],
      'my-app',
      'first',
    );

    const exported = await exportChats(db);
    const result = await importChats(db, exported);

    expect(result).toEqual({ imported: 1, skipped: 0 });

    const all = await getAll(db);

    expect(all).toHaveLength(2);

    const imported = all.find((c) => c.description === 'first' && c.id !== '1');

    expect(imported).toBeDefined();
    expect(imported?.urlId).not.toBe('my-app');
    expect(imported?.urlId).toBe('my-app-2');
  });

  it('should skip chats missing urlId or description during import', async () => {
    const db = await openTestDb();

    const result = await importChats(db, {
      version: 1,
      exportedAt: new Date().toISOString(),
      chats: [
        { id: 'x', messages: [], timestamp: new Date().toISOString() },
        { id: 'y', urlId: 'ok', description: 'ok', messages: [], timestamp: new Date().toISOString() },
      ],
    });

    expect(result).toEqual({ imported: 1, skipped: 1 });
  });

  it('should reject a malformed payload with a zod error', async () => {
    const db = await openTestDb();

    await expect(importChats(db, { version: 2, chats: [] })).rejects.toThrow();
    await expect(importChats(db, { chats: 'nope' })).rejects.toThrow();
    await expect(importChats(db, null)).rejects.toThrow();
  });

  it('should normalize legacy content messages during import', async () => {
    const db = await openTestDb();

    const result = await importChats(db, {
      version: 1,
      exportedAt: new Date().toISOString(),
      chats: [
        {
          id: 'legacy-id',
          urlId: 'legacy-chat',
          description: 'Legacy chat',
          messages: [{ id: 'legacy-message', role: 'user', content: 'hello from v3' }],
          timestamp: new Date().toISOString(),
        },
      ],
    });

    const imported = (await getAll(db))[0];

    expect(result).toEqual({ imported: 1, skipped: 0 });
    expect(imported.messages[0]?.parts).toEqual([{ type: 'text', text: 'hello from v3' }]);
  });

  it('should round-trip provider settings in the local settings store', async () => {
    const db = await openTestDb();
    const settings = { model: 'openai-compatible:llama3.1', providers: { openai: { apiKey: 'key' } } };

    await setSetting(db, 'provider-config', settings);

    expect(await getSetting<typeof settings>(db, 'provider-config')).toEqual(settings);
  });
});
