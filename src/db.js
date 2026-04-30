import { JSONFilePreset } from 'lowdb/node';
import path from 'path';
import { GLOBAL_DIR } from './config.js';

const dbPath = path.join(GLOBAL_DIR, 'db.json');

const defaultData = {
  logs: [],
  config: {},
  memory: {
    message: { aliases_static: {}, aliases_learned: {}, mappings: [] },
    mood: { aliases_static: {}, aliases_learned: {}, mappings: [] }
  }
};

/**
 * Get the lowdb instance
 */
export async function getDb() {
  const db = await JSONFilePreset(dbPath, defaultData);
  return db;
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
