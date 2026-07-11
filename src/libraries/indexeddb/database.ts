/**
 * `Database`. The entrypoint of the reusable IndexedDB library.
 * Responsibilities:
 * - Opening / re-opening the IDB connection (with a single in-flight promise).
 * - Running migrations in `versionchange` transactions.
 * - Exposing typed `TypedStore` handles to callers.
 * - Whole-database export / import for safe backups.
 * What this module deliberately does NOT do:
 * - Know anything about activities, weights, or app state.
 * - Attempt automatic schema diffing. Migrations are explicit and ordered. 
 */

import { TypedStore } from './store';
import type { DBBackup, DBConfig, Migration, StoreSchema, TransactionMode } from './types';

/** Run a request and resolve when it completes (or reject on error). */
function awaitRequest<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
	});
}

/** Wait for a transaction to fully commit (oncomplete) or report errors. */
function awaitTransaction(transaction: IDBTransaction): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		transaction.oncomplete = () => resolve();
		transaction.onerror = () =>
			reject(transaction.error ?? new Error('IndexedDB transaction failed'));
		transaction.onabort = () =>
			reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
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

	// Lifecycle

	/** Open the database. Subsequent calls return the same connection. */
	async open(): Promise<IDBDatabase> {
		if (this.connection) return this.connection;
		if (this.opening) return this.opening;
		this.opening = this.doOpen()
			.then((database) => {
				this.connection = database;
				this.opening = null;
				return database;
			})
			.catch((error) => {
				this.opening = null;
				throw error;
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
		if (!this.config.expectedStores.find((storeSchema) => storeSchema.name === name)) {
			throw new Error(`[idb] Unknown store "${name}". Add it to expectedStores in the DB config.`);
		}
		return new TypedStore<T>(this, name);
	}

	/** Run a transaction with a callback. Auto-commits on resolve. */
	async transact<T>(
		storeNames: string | string[],
		mode: TransactionMode,
		fn: (transaction: IDBTransaction) => Promise<T> | T,
	): Promise<T> {
		const database = await this.open();
		const transaction = database.transaction(storeNames, mode);
		let result: T;
		try {
			result = await fn(transaction);
		}
		catch (error) {
			try {
				transaction.abort();
			}
			catch {
				// already aborted
			}
			throw error;
		}
		await awaitTransaction(transaction);
		return result;
	}

	// Backup

	/** Snapshot every record in every store into a plain object. */
	async exportAll(): Promise<DBBackup> {
		const database = await this.open();
		const storeNames = Array.from(database.objectStoreNames);
		const stores: { [key: string]: unknown[] } = {};
		if (storeNames.length === 0) {
			return {
				name: this.config.name,
				version: this.config.version,
				exportedAt: Date.now(),
				stores,
			};
		}
		const transaction = database.transaction(storeNames, 'readonly');
		await Promise.all(
			storeNames.map(async (name) => {
				const all = await awaitRequest(transaction.objectStore(name).getAll());
				stores[name] = all;
			}),
		);
		await awaitTransaction(transaction);
		return {
			name: this.config.name,
			version: this.config.version,
			exportedAt: Date.now(),
			stores,
		};
	}

	/**
	 * Replace database contents from a backup. Each store listed in `stores` is cleared and rewritten. Stores not listed are left untouched. We never silently destroy stores not present in the backup. If a store named in the backup doesn't exist in the current schema, we throw. Protects against importing into a mismatched DB version. 
 */
	async importAll(backup: DBBackup): Promise<void> {
		const database = await this.open();
		const present = new Set(Array.from(database.objectStoreNames));
		const incoming = Object.keys(backup.stores);
		for (const name of incoming) {
			if (!present.has(name)) {
				throw new Error(`[idb] Backup contains unknown store "${name}". Refusing to import.`);
			}
		}
		if (incoming.length === 0) return;

		const transaction = database.transaction(incoming, 'readwrite');
		for (const name of incoming) {
			const store = transaction.objectStore(name);
			await awaitRequest(store.clear());
			const rows = backup.stores[name];
			for (const row of rows) {
				// We accept arbitrary rows from a trusted JSON file.
				await awaitRequest(store.put(row as unknown as object));
			}
		}
		await awaitTransaction(transaction);
	}

	// Internals

	private validateConfig(config: DBConfig): void {
		if (config.version < 1) throw new Error('[idb] version must be >= 1');
		const sorted = [...config.migrations].sort(
			(migration1, migration2) => migration1.toVersion - migration2.toVersion,
		);
		for (let i = 1; i < sorted.length; i++) {
			if (sorted[i].toVersion === sorted[i - 1].toVersion) {
				throw new Error(`[idb] duplicate migration target ${sorted[i].toVersion}`);
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
			(migration1, migration2) => migration1.toVersion - migration2.toVersion,
		);
		const targetVersion = this.config.version;

		const database = await new Promise<IDBDatabase>((resolve, reject) => {
			const request = indexedDB.open(this.config.name, targetVersion);

			request.onupgradeneeded = (event) => {
				const upgrade = request.result;
				const transaction = request.transaction;
				if (!transaction) {
					reject(new Error('[idb] missing upgrade transaction'));
					return;
				}
				const fromVersion = event.oldVersion;
				const toVersion = event.newVersion ?? targetVersion;
				for (const migration of sortedMigrations) {
					if (migration.toVersion > fromVersion && migration.toVersion <= toVersion) {
						migration.apply({
							db: upgrade,
							transaction,
							fromVersion,
							toVersion: migration.toVersion,
						});
					}
				}
			};

			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error ?? new Error('[idb] open failed'));
			request.onblocked = () =>
				reject(
					new Error('[idb] open blocked. Close other tabs running an older version of this app'),
				);
		});

		// Verify all expected stores actually exist post-migration.
		const present = new Set(Array.from(database.objectStoreNames));
		const missing: StoreSchema[] = [];
		for (const storeSchema of this.config.expectedStores) {
			if (!present.has(storeSchema.name)) missing.push(storeSchema);
		}
		if (missing.length > 0) {
			database.close();
			throw new Error(
				`[idb] migrations did not produce expected stores: ${missing
					.map((storeSchema) => storeSchema.name)
					.join(', ')}`,
			);
		}

		database.onversionchange = () => {
			// Another tab requested a higher version; release our connection so it can proceed.
			database.close();
			this.connection = null;
		};

		return database;
	}

	// Helper for stores

	/** Internal hook used by TypedStore. Exposes a transaction handle. */
	async _open(): Promise<IDBDatabase> {
		return this.open();
	}
}
