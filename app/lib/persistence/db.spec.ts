import { indexedDB } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { deleteByUrlId, exportChats, getAll, setMessages, updateChatDescription } from './db';

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
});
