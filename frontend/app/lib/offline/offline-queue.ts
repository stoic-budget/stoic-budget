/**
 * Entries made without a network, kept in IndexedDB until they can be sent.
 *
 * The storage is behind a small interface so the replay logic is testable
 * with an in-memory store; the browser store keeps `File` blobs as they are.
 */

export type OfflineEntryKind = 'manual-expense' | 'receipt-scan';

export interface OfflineEntry {
  id: string;
  kind: OfflineEntryKind;
  createdAt: string;
  /** Form fields, all strings so they survive structured clone. */
  fields: Record<string, string>;
  files: File[];
  /**
   * The workspace the photos were taken in (#784): replayed into it, not into
   * whichever one is open when the network comes back. Entries queued before
   * this was stored have none and go to the open one.
   */
  workspaceId?: string | null;
  /**
   * Who queued it: only they send it (#784). Another person signing in on the
   * device leaves it waiting. Older entries have none and go with anyone.
   */
  userId?: string | null;
  attempts: number;
  lastError?: string;
}

/**
 * The person signed in on this device, kept by `useOfflineQueue`: entries
 * are stamped with it when queued and sent only while it is the same.
 */
let signedInUserId: string | null = null;
export function setOfflineQueueUser(userId: string | null): void {
  signedInUserId = userId;
}

export interface OfflineStore {
  list(): Promise<OfflineEntry[]>;
  put(entry: OfflineEntry): Promise<void>;
  remove(id: string): Promise<void>;
}

// Named before the rename; a new name would strand entries still waiting to be sent.
const DB_NAME = 'lumio-offline';
const STORE = 'queue';
export const OFFLINE_QUEUE_EVENT = 'seneca-offline-queue';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    db =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const request = run(transaction.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => db.close();
      }),
  );
}

export const indexedDbStore: OfflineStore = {
  list: () => tx<OfflineEntry[]>('readonly', store => store.getAll()),
  put: entry => tx('readwrite', store => store.put(entry)).then(() => undefined),
  remove: id => tx('readwrite', store => store.delete(id)).then(() => undefined),
};

export function isOfflineStoreAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

export function createMemoryStore(initial: OfflineEntry[] = []): OfflineStore {
  const rows = new Map(initial.map(entry => [entry.id, entry]));
  return {
    list: async () => [...rows.values()],
    put: async entry => {
      rows.set(entry.id, entry);
    },
    remove: async id => {
      rows.delete(id);
    },
  };
}

export async function enqueue(
  store: OfflineStore,
  input: Pick<OfflineEntry, 'kind' | 'fields' | 'files' | 'workspaceId'>,
  userId: string | null = signedInUserId,
): Promise<OfflineEntry> {
  const entry: OfflineEntry = {
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : String(Date.now()),
    createdAt: new Date().toISOString(),
    attempts: 0,
    userId,
    ...input,
  };
  await store.put(entry);
  notifyQueueChanged();
  return entry;
}

/** A network failure, not a server verdict: the request never got an HTTP status. */
export function isNetworkFailure(status: number | undefined): boolean {
  return status === undefined || status === 0;
}

export interface ReplayResult {
  sent: number;
  kept: number;
}

/**
 * Not the server judging the entry but the session: signed out (401). The
 * entry waits for its owner to sign in again, as for a network failure (#784).
 */
const isSessionRefusal = (status: number | undefined) => status === 401;

/**
 * Sends every queued entry, oldest first. An entry the server rejects (4xx)
 * is dropped as unfixable from here; a network failure, a refused session or
 * a 409 saying the same request is still running (its idempotency key is
 * taken) keeps it for next time and stops the run.
 */
export async function replay(
  store: OfflineStore,
  send: (
    entry: OfflineEntry,
  ) => Promise<{ ok: true } | { ok: false; status: number | undefined; error: string }>,
): Promise<ReplayResult> {
  const entries = (await store.list()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  let sent = 0;
  let kept = 0;
  let dropped = 0;
  for (const entry of entries) {
    // Someone else's photos wait for them, untouched.
    if (entry.userId && entry.userId !== signedInUserId) {
      kept += 1;
      continue;
    }
    const result = await send(entry);
    if (result.ok) {
      await store.remove(entry.id);
      sent += 1;
      continue;
    }
    if (
      isNetworkFailure(result.status) ||
      isSessionRefusal(result.status) ||
      result.status === 409
    ) {
      await store.put({ ...entry, attempts: entry.attempts + 1, lastError: result.error });
      kept = entries.length - sent - dropped;
      break;
    }
    // The server answered and said no: keeping it would only fail again.
    await store.remove(entry.id);
    dropped += 1;
  }
  notifyQueueChanged();
  return { sent, kept };
}

function notifyQueueChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(OFFLINE_QUEUE_EVENT));
  }
}
