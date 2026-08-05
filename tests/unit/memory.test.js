/**
 * src/memory.js used to persist to a standalone memory.json via fs; it now
 * lives in the lowdb store behind getDb(). These tests drive the current async
 * API — the fs mock is only here for the two functions that still touch the
 * filesystem directly, export and import.
 */
import { jest } from '@jest/globals';

const fsMock = {
  existsSync: jest.fn(() => true),
  readFileSync: jest.fn(() => '{}'),
  writeFileSync: jest.fn()
};

jest.unstable_mockModule('fs', () => ({ ...fsMock, default: fsMock }));

const db = {
  data: { logs: [], config: {}, memory: {} },
  write: jest.fn(async () => {})
};

jest.unstable_mockModule('../../src/db.js', () => ({
  getDb: jest.fn(async () => db),
  add: jest.fn(async () => {}),
  list: jest.fn(async () => []),
  remove: jest.fn(async () => {}),
  updateCollection: jest.fn(async () => {}),
  resetDb: jest.fn()
}));

const { loadMemory, getMemory, learn, exportMemory, importMemory } =
  await import('../../src/memory.js');

describe('Memory Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.data = { logs: [], config: {}, memory: {} };
    fsMock.existsSync.mockReturnValue(true);
  });

  test('should expose the default memory shape synchronously', () => {
    const memory = loadMemory();
    expect(memory.message.mappings).toEqual([]);
    expect(memory.mood.mappings).toEqual([]);
  });

  test('should seed and persist default memory when the store is empty', async () => {
    const memory = await getMemory();

    expect(memory.message.mappings).toEqual([]);
    expect(memory.mood.mappings).toEqual([]);
    // The seeded defaults have to be written back, not just returned.
    expect(db.write).toHaveBeenCalled();
    expect(db.data.memory.message).toBeDefined();
  });

  test('should not hand out the shared default object', async () => {
    const first = await getMemory();
    first.message.mappings.push({ input: 'scribble' });

    db.data = { logs: [], config: {}, memory: {} };
    const second = await getMemory();

    expect(second.message.mappings).toEqual([]);
  });

  test('should learn a new mapping and save it', async () => {
    await learn('test message', 'action', 'action', 'message');

    const mappings = db.data.memory.message.mappings;
    expect(mappings).toHaveLength(1);
    expect(mappings[0]).toMatchObject({
      input: 'test message',
      normalized: 'test message',
      category: 'action',
      resolved: 'action',
      count: 1
    });
    expect(db.write).toHaveBeenCalled();
  });

  test('should increment count if mapping already exists', async () => {
    await learn('test', 'action', 'action', 'message');
    await learn('test', 'action', 'action', 'message');

    const mappings = db.data.memory.message.mappings;
    expect(mappings).toHaveLength(1);
    expect(mappings[0].count).toBe(2);
  });

  test('should match existing mappings regardless of case and padding', async () => {
    await learn('Deploy Now', 'action', 'action', 'message');
    await learn('  deploy now  ', 'decision', 'decision', 'message');

    const mappings = db.data.memory.message.mappings;
    expect(mappings).toHaveLength(1);
    expect(mappings[0].count).toBe(2);
    // The later correction wins.
    expect(mappings[0].resolved).toBe('decision');
  });

  test('should keep message and mood mappings in separate buckets', async () => {
    await learn('shipped it', 'action', 'action', 'message');
    await learn('shipped it', 'happy', 'happy', 'mood');

    expect(db.data.memory.message.mappings).toHaveLength(1);
    expect(db.data.memory.mood.mappings).toHaveLength(1);
  });

  test('should export memory correctly', async () => {
    await learn('exported entry', 'action', 'action', 'message');

    const result = await exportMemory('/tmp/out.json');

    expect(result).toBe(true);
    expect(fsMock.writeFileSync).toHaveBeenCalledWith('/tmp/out.json', expect.any(String), 'utf8');
    const payload = JSON.parse(fsMock.writeFileSync.mock.calls[0][1]);
    expect(payload.message.mappings[0].input).toBe('exported entry');
  });

  test('should merge memory during import correctly', async () => {
    await learn('old', 'action', 'action', 'message');

    fsMock.readFileSync.mockReturnValue(JSON.stringify({
      message: {
        mappings: [{ input: 'old', count: 2 }, { input: 'new', count: 1 }],
        aliases_learned: { a: 'b' }
      },
      mood: { mappings: [], aliases_learned: {} }
    }));

    const result = await importMemory('/tmp/in.json');

    expect(result).toBe(true);
    const merged = db.data.memory.message;
    expect(merged.mappings.find(m => m.input === 'old').count).toBe(3);
    expect(merged.mappings.find(m => m.input === 'new')).toBeDefined();
    expect(merged.aliases_learned.a).toBe('b');
  });

  test('should refuse to import a file that does not exist', async () => {
    fsMock.existsSync.mockReturnValue(false);

    expect(await importMemory('/tmp/missing.json')).toBe(false);
    expect(fsMock.readFileSync).not.toHaveBeenCalled();
  });
});
