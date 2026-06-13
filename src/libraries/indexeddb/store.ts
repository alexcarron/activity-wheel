/**
 * `TypedStore<T>` — a small, typed wrapper around an IDB object store.
 *
 * One `TypedStore` is bound to a single store name. Each call opens a fresh
 * transaction (this matches IDB semantics: a transaction must not be reused
 * after a microtask boundary). For multi-statement work, use
 * `Database.transact()` directly.
 *
 * The library is generic over the row type `T`; callers do their own
 * narrowing — we don't impose runtime validators.
 */

import type { Database } from './database';

function awaitRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

function awaitTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

export class TypedStore<T extends object> {
  private readonly db: Database;
  private readonly name: string;

  constructor(db: Database, name: string) {
    this.db = db;
    this.name = name;
  }

  /* --------------------------- Reads ------------------------------------ */

  async get(key: IDBValidKey): Promise<T | undefined> {
    const conn = await this.db._open();
    const tx = conn.transaction(this.name, 'readonly');
    const result = await awaitRequest<T | undefined>(
      tx.objectStore(this.name).get(key) as IDBRequest<T | undefined>,
    );
    await awaitTransaction(tx);
    return result;
  }

  async getAll(): Promise<T[]> {
    const conn = await this.db._open();
    const tx = conn.transaction(this.name, 'readonly');
    const result = await awaitRequest<T[]>(
      tx.objectStore(this.name).getAll() as IDBRequest<T[]>,
    );
    await awaitTransaction(tx);
    return result;
  }

  async count(): Promise<number> {
    const conn = await this.db._open();
    const tx = conn.transaction(this.name, 'readonly');
    const result = await awaitRequest<number>(
      tx.objectStore(this.name).count(),
    );
    await awaitTransaction(tx);
    return result;
  }

  async getAllByIndex(indexName: string, query?: IDBKeyRange | IDBValidKey): Promise<T[]> {
    const conn = await this.db._open();
    const tx = conn.transaction(this.name, 'readonly');
    const idx = tx.objectStore(this.name).index(indexName);
    const result = await awaitRequest<T[]>(idx.getAll(query) as IDBRequest<T[]>);
    await awaitTransaction(tx);
    return result;
  }

  /* --------------------------- Writes ----------------------------------- */

  async put(value: T): Promise<IDBValidKey> {
    const conn = await this.db._open();
    const tx = conn.transaction(this.name, 'readwrite');
    const key = await awaitRequest<IDBValidKey>(
      tx.objectStore(this.name).put(value),
    );
    await awaitTransaction(tx);
    return key;
  }

  /**
   * Batch-write many records in a single transaction. Significantly faster
   * than calling `put` in a loop and avoids partial commits on errors.
   */
  async putMany(values: readonly T[]): Promise<void> {
    if (values.length === 0) return;
    const conn = await this.db._open();
    const tx = conn.transaction(this.name, 'readwrite');
    const store = tx.objectStore(this.name);
    for (const v of values) {
      // Don't await individual requests — IDB queues them. Only await the
      // transaction's `oncomplete` below.
      store.put(v);
    }
    await awaitTransaction(tx);
  }

  async delete(key: IDBValidKey): Promise<void> {
    const conn = await this.db._open();
    const tx = conn.transaction(this.name, 'readwrite');
    await awaitRequest<undefined>(tx.objectStore(this.name).delete(key));
    await awaitTransaction(tx);
  }

  async clear(): Promise<void> {
    const conn = await this.db._open();
    const tx = conn.transaction(this.name, 'readwrite');
    await awaitRequest<undefined>(tx.objectStore(this.name).clear());
    await awaitTransaction(tx);
  }
}
