/**
 * Public surface of the reusable IndexedDB library.
 *
 * Other apps can copy `src/lib/indexeddb/` into their project and import:
 *
 *   import { Database } from './lib/indexeddb';
 *   import type { DBConfig, Migration } from './lib/indexeddb';
 */

export { Database } from './database';
export { TypedStore } from './store';
export type {
  DBBackup,
  DBConfig,
  IndexSchema,
  Migration,
  MigrationContext,
  StoreSchema,
  TransactionMode,
} from './types';
