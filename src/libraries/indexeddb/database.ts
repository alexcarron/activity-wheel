/**
 * `Database` — the entrypoint of the reusable IndexedDB library.
 *
 * Responsibilities:
 *  - Opening / re-opening the IDB connection (with a single in-flight promise).
 *  - Running migrations in `versionchange` transactions.
 *  - Exposing typed `TypedStore` handles to callers.
 *  - Whole-database export / import for safe backups.
 *
 * What this module deliberately does NOT do:
 *  - Know anything about activities, weights, or app state.
 *  - Attempt automatic schema diffing — migrations are explicit and ordered.
 */

import { TypedStore } from './store';
import type {
  DBBackup,
  DBConfig,
  Migration,
  StoreSchema,
  TransactionMode,
} from './types';

/** Run a request and resolve when it completes (or reject on error). */
function awaitRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

/** Wait for a transaction to fully commit (oncomplete) or report errors. */
function awaitTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

export class Database {
  private readonly config: DBConfig;
  private connection: IDBDatabase | null = null;
  private opening: Promise<IDBDatabase> | null = null;

  constructor(config: DBConfig) {
    this.config = config;
    this.validateConfig(config);
  }

  /* ----------------------------- Lifecycle ------------------------------ */

  /** Open the database. Subsequent calls return the same connection. */
  async open(): Promise<IDBDatabase> {
    if (this.connection) return this.connection;
    if (this.opening) return this.opening;
    this.opening = this.doOpen()
      .then((db) => {
        this.connection = db;
        this.opening = null;
        return db;
      })
      .catch((err) => {
        this.opening = null;
        throw err;
      });
    return this.opening;
  }

  /** Force-close the connection. Mostly used by tests / dev tools. */
  close(): void {
    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }
  }

  /** Get a typed handle to a store. The store must exist in the schema. */
  store<T extends object>(name: string): TypedStore<T> {
    if (!this.config.expectedStores.find((s) => s.name === name)) {
      throw new Error(
        `[idb] Unknown store "${name}". Add it to expectedStores in the DB config.`,
      );
    }
    return new TypedStore<T>(this, name);
  }

  /** Run a transaction with a callback. Auto-commits on resolve. */
  async transact<T>(
    storeNames: string | string[],
    mode: TransactionMode,
    fn: (tx: IDBTransaction) => Promise<T> | T,
  ): Promise<T> {
    const db = await this.open();
    const tx = db.transaction(storeNames, mode);
    let result: T;
    try {
      result = await fn(tx);
    } catch (err) {
      try {
        tx.abort();
      } catch {
        // already aborted
      }
      throw err;
    }
    await awaitTransaction(tx);
    return result;
  }

  /* ----------------------------- Backup --------------------------------- */

  /** Snapshot every record in every store into a plain object. */
  async exportAll(): Promise<DBBackup> {
    const db = await this.open();
    const storeNames = Array.from(db.objectStoreNames);
    const stores: { [key: string]: unknown[] } = {};
    if (storeNames.length === 0) {
      return {
        name: this.config.name,
        version: this.config.version,
        exportedAt: Date.now(),
        stores,
      };
    }
    const tx = db.transaction(storeNames, 'readonly');
    await Promise.all(
      storeNames.map(async (name) => {
        const all = await awaitRequest(tx.objectStore(name).getAll());
        stores[name] = all;
      }),
    );
    await awaitTransaction(tx);
    return {
      name: this.config.name,
      version: this.config.version,
      exportedAt: Date.now(),
      stores,
    };
  }

  /**
   * Replace database contents from a backup. Each store listed in `stores`
   * is cleared and rewritten. Stores not listed are left untouched. We
   * never silently destroy stores not present in the backup.
   *
   * If a store named in the backup doesn't exist in the current schema,
   * we throw — protects against importing into a mismatched DB version.
   */
  async importAll(backup: DBBackup): Promise<void> {
    const db = await this.open();
    const present = new Set(Array.from(db.objectStoreNames));
    const incoming = Object.keys(backup.stores);
    for (const name of incoming) {
      if (!present.has(name)) {
        throw new Error(
          `[idb] Backup contains unknown store "${name}". Refusing to import.`,
        );
      }
    }
    if (incoming.length === 0) return;

    const tx = db.transaction(incoming, 'readwrite');
    for (const name of incoming) {
      const store = tx.objectStore(name);
      await awaitRequest(store.clear());
      const rows = backup.stores[name];
      for (const row of rows) {
        // We accept arbitrary rows from a trusted JSON file.
        await awaitRequest(store.put(row as unknown as object));
      }
    }
    await awaitTransaction(tx);
  }

  /* ----------------------------- Internals ------------------------------ */

  private validateConfig(config: DBConfig): void {
    if (config.version < 1) throw new Error('[idb] version must be >= 1');
    const sorted = [...config.migrations].sort((a, b) => a.toVersion - b.toVersion);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].toVersion === sorted[i - 1].toVersion) {
        throw new Error(
          `[idb] duplicate migration target ${sorted[i].toVersion}`,
        );
      }
    }
    const last = sorted[sorted.length - 1];
    if (last && last.toVersion > config.version) {
      throw new Error(
        `[idb] migration toVersion ${last.toVersion} exceeds config.version ${config.version}`,
      );
    }
  }

  private async doOpen(): Promise<IDBDatabase> {
    if (typeof indexedDB === 'undefined') {
      throw new Error(
        '[idb] IndexedDB is unavailable in this environment. Try a different browser or disable private mode.',
      );
    }
    const sortedMigrations: Migration[] = [...this.config.migrations].sort(
      (a, b) => a.toVersion - b.toVersion,
    );
    const targetVersion = this.config.version;

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(this.config.name, targetVersion);

      req.onupgradeneeded = (event) => {
        const upgrade = req.result;
        const tx = req.transaction;
        if (!tx) {
          reject(new Error('[idb] missing upgrade transaction'));
          return;
        }
        const fromVersion = event.oldVersion;
        const toVersion = event.newVersion ?? targetVersion;
        for (const m of sortedMigrations) {
          if (m.toVersion > fromVersion && m.toVersion <= toVersion) {
            m.apply({
              db: upgrade,
              transaction: tx,
              fromVersion,
              toVersion: m.toVersion,
            });
          }
        }
      };

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('[idb] open failed'));
      req.onblocked = () =>
        reject(
          new Error(
            '[idb] open blocked — close other tabs running an older version of this app',
          ),
        );
    });

    // Verify all expected stores actually exist post-migration.
    const present = new Set(Array.from(db.objectStoreNames));
    const missing: StoreSchema[] = [];
    for (const s of this.config.expectedStores) {
      if (!present.has(s.name)) missing.push(s);
    }
    if (missing.length > 0) {
      db.close();
      throw new Error(
        `[idb] migrations did not produce expected stores: ${missing
          .map((s) => s.name)
          .join(', ')}`,
      );
    }

    db.onversionchange = () => {
      // Another tab requested a higher version; release our connection so it can proceed.
      db.close();
      this.connection = null;
    };

    return db;
  }

  /* ------------------------- Helper for stores -------------------------- */

  /** Internal hook used by TypedStore — exposes a transaction handle. */
  async _open(): Promise<IDBDatabase> {
    return this.open();
  }
}
