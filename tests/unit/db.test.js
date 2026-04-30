import { add, list, remove, getDb } from '../../src/db.js';
import fs from 'fs';
import path from 'path';
import { GLOBAL_DIR } from '../../src/config.js';

describe('Database Module (lowdb)', () => {
  const dbPath = path.join(GLOBAL_DIR, 'db.json');

  beforeEach(async () => {
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    // Reiniciar o banco para cada teste
  });

  test('should add a log entry with validation', async () => {
    await add('logs', { note: 'Test log' });
    const logs = await list('logs');
    expect(logs.length).toBe(1);
    expect(logs[0].note).toBe('Test log');
    expect(logs[0].id).toBeDefined();
  });

  test('should throw error for empty log', async () => {
    await expect(add('logs', { note: '' })).rejects.toThrow('LOG_EMPTY');
  });

  test('should list items with filter', async () => {
    await add('logs', { note: 'Log 1', type: 'action' });
    await add('logs', { note: 'Log 2', type: 'decision' });
    
    const actions = await list('logs', (l) => l.type === 'action');
    expect(actions.length).toBe(1);
    expect(actions[0].note).toBe('Log 1');
  });

  test('should remove items', async () => {
    await add('logs', { note: 'To be removed', id: '123' });
    await remove('logs', (l) => l.id === '123');
    
    const logs = await list('logs');
    expect(logs.length).toBe(0);
  });
});
