// @vitest-environment node
import type { UIMessage } from 'ai';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ChatHistoryItem } from './useChatHistory';

/**
 * `node:sqlite` is an experimental builtin vite's resolver does not recognize; load it
 * through createRequire, which vite skips transform on and resolves builtins natively.
 */
import { createRequire } from 'node:module';

interface Statement {
  run: (...params: unknown[]) => void;
  all: (...params: unknown[]) => unknown[];
}

interface DatabaseSync {
  exec: (sql: string) => void;
  prepare: (sql: string) => Statement;
}

const require = createRequire(import.meta.url);

// eslint-disable-next-line @typescript-eslint/naming-convention -- mirrors the upstream class name
const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: new (path: string) => DatabaseSync };

/**
 * Drives the same chat-history operations as `db.ts` against a real SQLite
 * database (in-memory) to validate the SQL semantics the IndexedDB layer mirrors:
 * recency ordering, rename, export shape, and delete-by-urlId.
 */

interface Row {
  id: string;
  urlId: string | null;
  description: string | null;
  messages: string;
  timestamp: string;
}

function createDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');

  db.exec(`
    CREATE TABLE chats (
      id TEXT PRIMARY KEY,
      urlId TEXT UNIQUE,
      description TEXT,
      messages TEXT NOT NULL,
      timestamp TEXT NOT NULL
    )
  `);

  return db;
}

function insertChat(db: DatabaseSync, chat: ChatHistoryItem) {
  db.prepare('INSERT INTO chats (id, urlId, description, messages, timestamp) VALUES (?, ?, ?, ?, ?)').run(
    chat.id,
    chat.urlId ?? null,
    chat.description ?? null,
    JSON.stringify(chat.messages),
    chat.timestamp,
  );
}

function getAllSorted(db: DatabaseSync): ChatHistoryItem[] {
  const rows = db.prepare('SELECT * FROM chats ORDER BY timestamp DESC').all() as unknown as Row[];

  return rows.map((row) => ({
    id: row.id,
    urlId: row.urlId ?? undefined,
    description: row.description ?? undefined,
    messages: JSON.parse(row.messages),
    timestamp: row.timestamp,
  }));
}

function updateDescription(db: DatabaseSync, id: string, description: string) {
  db.prepare('UPDATE chats SET description = ? WHERE id = ?').run(description, id);
}

function deleteByUrlId(db: DatabaseSync, urlId: string) {
  db.prepare('DELETE FROM chats WHERE urlId = ?').run(urlId);
}

function chat(id: string, timestamp: string, extra: Partial<ChatHistoryItem> = {}): ChatHistoryItem {
  return { id, timestamp, messages: [], ...extra };
}

describe('chat history (SQLite semantics)', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = createDb();
  });

  it('should return chats sorted by most recent first', () => {
    insertChat(db, chat('1', '2024-01-01T00:00:00Z'));
    insertChat(db, chat('3', '2024-03-01T00:00:00Z'));
    insertChat(db, chat('2', '2024-02-01T00:00:00Z'));

    expect(getAllSorted(db).map((c) => c.id)).toEqual(['3', '2', '1']);
  });

  it('should rename a chat by id', () => {
    insertChat(db, chat('1', '2024-01-01T00:00:00Z', { description: 'old' }));

    updateDescription(db, '1', 'new title');

    expect(getAllSorted(db)[0].description).toBe('new title');
  });

  it('should delete a chat by urlId', () => {
    insertChat(db, chat('1', '2024-01-01T00:00:00Z', { urlId: 'my-app' }));
    insertChat(db, chat('2', '2024-02-01T00:00:00Z', { urlId: 'other' }));

    deleteByUrlId(db, 'my-app');

    expect(getAllSorted(db).map((c) => c.id)).toEqual(['2']);
  });

  it('should round-trip messages through export shape', () => {
    const messages = [
      { id: '1', role: 'user', parts: [{ type: 'text', text: 'hello' }] },
      { id: '2', role: 'assistant', parts: [{ type: 'text', text: 'hi' }] },
    ] as unknown as UIMessage[];

    insertChat(db, chat('1', '2024-01-01T00:00:00Z', { messages }));

    const exported = getAllSorted(db)[0];

    expect(exported.messages).toEqual(messages);
  });
});
