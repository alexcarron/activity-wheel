/**
 * Public types for the reusable IndexedDB library.
 * Design goals:
 * - Zero domain knowledge: this module knows nothing about activities.
 * - Declarative schema + ordered migrations: callers never write raw `onupgradeneeded` code.
 * - Strict typing: every store is parameterised by its record type. 
 */

/** Declarative shape of a single object store. */
export interface StoreSchema {
	/** Unique store name within the database. */
	readonly name: string;
	/** Field on each record used as the primary key. */
	readonly keyPath: string;
	/** If true, IDB will autoincrement an integer key when keyPath is absent. */
	readonly autoIncrement?: boolean;
	/** Secondary indexes for this store. */
	readonly indexes?: readonly IndexSchema[];
}

export interface IndexSchema {
	readonly name: string;
	readonly keyPath: string | readonly string[];
	readonly unique?: boolean;
	readonly multiEntry?: boolean;
}

/**
 * A migration runs when the DB is opened with a higher version than is present on disk. It receives the IDB upgrade transaction and the previous version number, so it can decide what to do incrementally.
 * Migrations should be additive. Never `deleteObjectStore` blindly. The library will refuse to silently wipe data: if no migration declares the store, opening simply errors. 
 */
export interface Migration {
	/** Target version this migration brings the DB up to. */
	readonly toVersion: number;
	/**
	 * Apply the schema changes for this version. The transaction is `versionchange` and is closed automatically when this returns. 
 */
	readonly apply: (ctx: MigrationContext) => void;
}

export interface MigrationContext {
	readonly db: IDBDatabase;
	readonly transaction: IDBTransaction;
	readonly fromVersion: number;
	readonly toVersion: number;
}

export interface DBConfig {
	/** Database name. Combined with origin to form the IDB key. */
	readonly name: string;
	/**
	 * Latest schema version. Must be ≥ 1 and ≥ the highest `toVersion` in `migrations`. 
 */
	readonly version: number;
	/** Ordered migrations. Will be applied in `toVersion` order. */
	readonly migrations: readonly Migration[];
	/**
	 * Stores expected to exist after migrations have run. Used as a sanity check on open. If any are missing, opening fails fast rather than silently giving the caller a busted handle. 
 */
	readonly expectedStores: readonly StoreSchema[];
}

/** Represents a structured-cloneable JSON snapshot of the entire database. */
export interface DBBackup {
	readonly name: string;
	readonly version: number;
	readonly exportedAt: number;
	readonly stores: { [storeName: string]: unknown[] };
}

export type TransactionMode = 'readonly' | 'readwrite';
