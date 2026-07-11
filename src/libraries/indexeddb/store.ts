/**
 * `TypedStore<T>`. A small, typed wrapper around an IDB object store.
 * One `TypedStore` is bound to a single store name. Each call opens a fresh transaction (this matches IDB semantics: a transaction must not be reused after a microtask boundary). For multi-statement work, use `Database.transact()` directly.
 * The library is generic over the row type `T`; callers do their own narrowing. We don't impose runtime validators. 
 */

import type { Database } from './database';

function awaitRequest<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
	});
}

function awaitTransaction(transaction: IDBTransaction): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		transaction.oncomplete = () => resolve();
		transaction.onerror = () =>
			reject(transaction.error ?? new Error('IndexedDB transaction failed'));
		transaction.onabort = () =>
			reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
	});
}

export class TypedStore<T extends object> {
	private readonly db: Database;
	private readonly name: string;

	constructor(db: Database, name: string) {
		this.db = db;
		this.name = name;
	}

	// Reads

	async get(key: IDBValidKey): Promise<T | undefined> {
		const connection = await this.db._open();
		const transaction = connection.transaction(this.name, 'readonly');
		const result = await awaitRequest<T | undefined>(
			transaction.objectStore(this.name).get(key) as IDBRequest<T | undefined>,
		);
		await awaitTransaction(transaction);
		return result;
	}

	async getAll(): Promise<T[]> {
		const connection = await this.db._open();
		const transaction = connection.transaction(this.name, 'readonly');
		const result = await awaitRequest<T[]>(
			transaction.objectStore(this.name).getAll() as IDBRequest<T[]>,
		);
		await awaitTransaction(transaction);
		return result;
	}

	async count(): Promise<number> {
		const connection = await this.db._open();
		const transaction = connection.transaction(this.name, 'readonly');
		const result = await awaitRequest<number>(transaction.objectStore(this.name).count());
		await awaitTransaction(transaction);
		return result;
	}

	async getAllByIndex(indexName: string, query?: IDBKeyRange | IDBValidKey): Promise<T[]> {
		const connection = await this.db._open();
		const transaction = connection.transaction(this.name, 'readonly');
		const index = transaction.objectStore(this.name).index(indexName);
		const result = await awaitRequest<T[]>(index.getAll(query) as IDBRequest<T[]>);
		await awaitTransaction(transaction);
		return result;
	}

	// Writes

	async put(value: T): Promise<IDBValidKey> {
		const connection = await this.db._open();
		const transaction = connection.transaction(this.name, 'readwrite');
		const key = await awaitRequest<IDBValidKey>(transaction.objectStore(this.name).put(value));
		await awaitTransaction(transaction);
		return key;
	}

	/**
	 * Batch-write many records in a single transaction. Significantly faster than calling `put` in a loop and avoids partial commits on errors. 
 */
	async putMany(values: readonly T[]): Promise<void> {
		if (values.length === 0) return;
		const connection = await this.db._open();
		const transaction = connection.transaction(this.name, 'readwrite');
		const store = transaction.objectStore(this.name);
		for (const value of values) {
			// Don't await individual requests. IDB queues them. Only await the
			// transaction's `oncomplete` below.
			store.put(value);
		}
		await awaitTransaction(transaction);
	}

	async delete(key: IDBValidKey): Promise<void> {
		const connection = await this.db._open();
		const transaction = connection.transaction(this.name, 'readwrite');
		await awaitRequest<undefined>(transaction.objectStore(this.name).delete(key));
		await awaitTransaction(transaction);
	}

	async clear(): Promise<void> {
		const connection = await this.db._open();
		const transaction = connection.transaction(this.name, 'readwrite');
		await awaitRequest<undefined>(transaction.objectStore(this.name).clear());
		await awaitTransaction(transaction);
	}
}
