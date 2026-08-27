import type { UIMessage } from 'ai';
import { createScopedLogger } from '~/utils/logger';
import { chatExportSchema, normalizeMessages } from './messages';
import type { ChatHistoryItem } from './useChatHistory';

const logger = createScopedLogger('ChatHistory');

// this is used at the top level and never rejects
export async function openDatabase(): Promise<IDBDatabase | undefined> {
  return new Promise((resolve) => {
    const request = indexedDB.open('boltHistory', 2);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('chats')) {
        const store = db.createObjectStore('chats', { keyPath: 'id' });
        store.createIndex('id', 'id', { unique: true });
        store.createIndex('urlId', 'urlId', { unique: true });
      }

      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };

    request.onsuccess = (event: Event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event: Event) => {
      resolve(undefined);
      logger.error((event.target as IDBOpenDBRequest).error);
    };
  });
}

export async function getAll(db: IDBDatabase): Promise<ChatHistoryItem[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');
    const request = store.getAll();

    request.onsuccess = () => {
      const items = request.result as ChatHistoryItem[];

      items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

      resolve(items);
    };

    request.onerror = () => reject(request.error);
  });
}

export async function setMessages(
  db: IDBDatabase,
  id: string,
  messages: UIMessage[],
  urlId?: string,
  description?: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readwrite');
    const store = transaction.objectStore('chats');

    const request = store.put({
      id,
      messages,
      urlId,
      description,
      timestamp: new Date().toISOString(),
    });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getMessages(db: IDBDatabase, id: string): Promise<ChatHistoryItem | undefined> {
  return (await getMessagesById(db, id)) || (await getMessagesByUrlId(db, id));
}

export async function getMessagesByUrlId(db: IDBDatabase, id: string): Promise<ChatHistoryItem | undefined> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');
    const index = store.index('urlId');
    const request = index.get(id);

    request.onsuccess = () => resolve(request.result as ChatHistoryItem);
    request.onerror = () => reject(request.error);
  });
}

export async function getMessagesById(db: IDBDatabase, id: string): Promise<ChatHistoryItem | undefined> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result as ChatHistoryItem);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteById(db: IDBDatabase, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readwrite');
    const store = transaction.objectStore('chats');
    const request = store.delete(id);

    request.onsuccess = () => resolve(undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function updateChatDescription(db: IDBDatabase, id: string, description: string): Promise<void> {
  const chat = await getMessagesById(db, id);

  if (!chat) {
    throw new Error(`Chat not found: ${id}`);
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readwrite');
    const store = transaction.objectStore('chats');
    const request = store.put({ ...chat, description });

    request.onsuccess = () => resolve(undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteByUrlId(db: IDBDatabase, urlId: string): Promise<void> {
  const chat = await getMessagesByUrlId(db, urlId);

  if (chat) {
    await deleteById(db, chat.id);
  }
}

export interface ChatExport {
  readonly version: 1;
  readonly exportedAt: string;
  readonly chats: ChatHistoryItem[];
}

export async function exportChats(db: IDBDatabase): Promise<ChatExport> {
  const chats = (await getAll(db)).map((chat) => ({
    ...chat,
    messages: normalizeMessages(chat.messages),
  }));

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    chats,
  };
}

export interface ImportChatsResult {
  readonly imported: number;
  readonly skipped: number;
}

/**
 * Imports chats from a previously exported `ChatExport` payload. Each chat gets a
 * fresh id and urlId so it never collides with existing entries. Malformed payloads
 * throw a zod error; individual chats missing a urlId/description are skipped
 * (matching what the sidebar renders).
 */
export async function importChats(db: IDBDatabase, payload: unknown): Promise<ImportChatsResult> {
  const parsed = chatExportSchema.parse(payload);

  let imported = 0;
  let skipped = 0;

  for (const chat of parsed.chats) {
    if (!chat.description || !chat.urlId) {
      skipped += 1;
      continue;
    }

    const nextId = await getNextId(db);
    const urlId = await getUrlId(db, chat.urlId);

    await setMessages(db, nextId, normalizeMessages(chat.messages), urlId, chat.description);

    imported += 1;
  }

  return { imported, skipped };
}

export async function getSetting<T>(db: IDBDatabase, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('settings', 'readonly');
    const store = transaction.objectStore('settings');
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result?.value as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function setSetting<T>(db: IDBDatabase, key: string, value: T): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('settings', 'readwrite');
    const store = transaction.objectStore('settings');
    const request = store.put({ key, value });

    request.onsuccess = () => resolve(undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function getNextId(db: IDBDatabase): Promise<string> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');
    const request = store.getAllKeys();

    request.onsuccess = () => {
      const highestId = request.result.reduce((cur, acc) => Math.max(+cur, +acc), 0);
      resolve(String(+highestId + 1));
    };

    request.onerror = () => reject(request.error);
  });
}

export async function getUrlId(db: IDBDatabase, id: string): Promise<string> {
  const idList = await getUrlIds(db);

  if (!idList.includes(id)) {
    return id;
  } else {
    let i = 2;

    while (idList.includes(`${id}-${i}`)) {
      i++;
    }

    return `${id}-${i}`;
  }
}

async function getUrlIds(db: IDBDatabase): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');
    const idList: string[] = [];

    const request = store.openCursor();

    request.onsuccess = (event: Event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

      if (cursor) {
        if (typeof cursor.value.urlId === 'string') {
          idList.push(cursor.value.urlId);
        }

        cursor.continue();
      } else {
        resolve(idList);
      }
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}
