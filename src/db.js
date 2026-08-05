import { JSONFilePreset } from 'lowdb/node';
import fs from 'fs';
import { GLOBAL_DIR, DB_PATH as dbPath } from './paths.js';

/**
 * Build the empty shape of the store.
 *
 * Returns a fresh object every call: lowdb's Low assigns the default straight
 * to `db.data` by reference and only replaces it when the adapter reads back
 * something non-null, so a shared module-level object would be mutated in
 * place by any instance whose store is still empty.
 */
function createDefaultData() {
  return {
    logs: [],
    config: {},
    memory: {
      message: { aliases_static: {}, aliases_learned: {}, mappings: [] },
      mood: { aliases_static: {}, aliases_learned: {}, mappings: [] }
    }
  };
}

let _dbPromise = null;

/**
 * Get the lowdb instance — one per process.
 *
 * Building a new instance per call is not safe. Each JSONFile gets its own
 * steno Writer, and every Writer for the same path stages its output in the
 * same temporary file (.db.json.tmp) before renaming it over db.json. Two
 * instances writing concurrently means the first rename consumes the temp file
 * and the second fails with an unhandled ENOENT that takes the process down —
 * saveLog alone can trigger it, since it deliberately lets the database write
 * run alongside the markdown writes. Sharing one instance puts every write
 * through a single Writer, which serializes them, and lets callers see each
 * other's changes without a re-read.
 *
 * The promise itself is memoized, not the resolved value, so concurrent
 * first-callers all await the same initialization instead of racing to create
 * competing instances.
 */
export async function getDb() {
  if (!_dbPromise) {
    // This module owns dbPath, so it owns the directory too. Relying on
    // src/config.js to have created it as an import side effect is not enough:
    // core.js reaches the store through db.js without importing config.js at
    // all, and steno's write fails with ENOENT when the directory is missing —
    // a failure saveLog swallows, so entries silently never reach disk.
    fs.mkdirSync(GLOBAL_DIR, { recursive: true });
    _dbPromise = JSONFilePreset(dbPath, createDefaultData());
  }
  return _dbPromise;
}

/**
 * Drop the memoized instance so the next getDb() reloads from disk.
 *
 * Exists for tests, which need to reset the store between cases; nothing in
 * the CLI path should need it, since a run is short-lived.
 */
export function resetDb() {
  _dbPromise = null;
}

/**
 * Add a record to a collection
 */
export async function add(collection, item) {
  if (collection === 'logs') {
    if (!item.note || item.note.trim() === '') throw new Error('LOG_EMPTY');
  }

  const db = await getDb();
  if (!db.data[collection]) db.data[collection] = [];
  db.data[collection].push({
    id: Date.now().toString(36) + Math.random().toString(36).substring(2),
    createdAt: new Date().toISOString(),
    ...item
  });
  await db.write();
}

/**
 * List records from a collection
 */
export async function list(collection, filter = () => true) {
  const db = await getDb();
  return (db.data[collection] || []).filter(filter);
}

/**
 * Remove records from a collection
 */
export async function remove(collection, filter) {
  const db = await getDb();
  if (!db.data[collection]) return;
  db.data[collection] = db.data[collection].filter(item => !filter(item));
  await db.write();
}

/**
 * Update the whole collection
 */
export async function updateCollection(collection, data) {
  const db = await getDb();
  db.data[collection] = data;
  await db.write();
}
