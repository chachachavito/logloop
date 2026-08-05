/**
 * src/core.js is native ESM, so jest.mock() with a factory does nothing here —
 * the import is hoisted and bound before the factory would ever run. Mocks have
 * to be registered with jest.unstable_mockModule *before* the module under test
 * is pulled in, which is why core.js is imported dynamically below.
 *
 * fs is backed by a small in-memory fake rather than bare jest.fn()s. safeWrite
 * re-reads and re-stats the file it just wrote and throws INTEGRITY_FAILURE if
 * the content does not check out, so stub functions that return nothing send
 * every write down the retry-then-fail path — the assertions still pass, while
 * saveLog quietly returns false. The fake keeps that path honest.
 */
import { jest } from '@jest/globals';

function createFakeFs() {
  const files = new Map();
  let nextFd = 1;
  const openFiles = new Map();

  const fake = {
    __files: files,

    existsSync: jest.fn(p => files.has(String(p))),

    readFileSync: jest.fn(p => {
      const key = String(p);
      if (!files.has(key)) {
        const err = new Error(`ENOENT: no such file or directory, open '${key}'`);
        err.code = 'ENOENT';
        throw err;
      }
      return files.get(key);
    }),

    writeFileSync: jest.fn((p, content) => { files.set(String(p), String(content)); }),

    appendFileSync: jest.fn((p, content) => {
      const key = String(p);
      files.set(key, (files.get(key) ?? '') + String(content));
    }),

    openSync: jest.fn((p, flags = 'r') => {
      const key = String(p);
      // 'wx' is how withLock claims the lock file: it must fail when the file
      // already exists, otherwise the lock is not a lock.
      if (flags.includes('x') && files.has(key)) {
        const err = new Error(`EEXIST: file already exists, open '${key}'`);
        err.code = 'EEXIST';
        throw err;
      }
      if (flags.startsWith('w') || !files.has(key)) files.set(key, files.get(key) ?? '');
      const fd = nextFd++;
      openFiles.set(fd, key);
      return fd;
    }),

    writeSync: jest.fn((fd, content) => {
      const key = openFiles.get(fd);
      files.set(key, (files.get(key) ?? '') + String(content));
      return Buffer.byteLength(String(content), 'utf8');
    }),

    closeSync: jest.fn(fd => { openFiles.delete(fd); }),
    fsyncSync: jest.fn(),

    statSync: jest.fn(p => ({ size: Buffer.byteLength(files.get(String(p)) ?? '', 'utf8') })),

    renameSync: jest.fn((from, to) => {
      const src = String(from);
      files.set(String(to), files.get(src) ?? '');
      files.delete(src);
    }),

    unlinkSync: jest.fn(p => { files.delete(String(p)); }),
    realpathSync: jest.fn(p => String(p)),
    mkdirSync: jest.fn(),
    readdirSync: jest.fn(() => [])
  };

  return fake;
}

const fakeFs = createFakeFs();

jest.unstable_mockModule('fs', () => ({ ...fakeFs, default: fakeFs }));

jest.unstable_mockModule('../../src/git.js', () => ({
  getGitMetadata: jest.fn(() => ({ hash: 'abc123', branch: 'main' })),
  isGitRepo: jest.fn(() => true),
  commitLog: jest.fn(() => true)
}));

jest.unstable_mockModule('../../src/classifier.js', () => ({
  classifyMessage: jest.fn(async () => ({ category: 'action' })),
  classifyMood: jest.fn(async () => ({ category: 'neutral' }))
}));

jest.unstable_mockModule('../../src/db.js', () => ({
  add: jest.fn(async () => true),
  list: jest.fn(async () => []),
  remove: jest.fn(async () => {}),
  updateCollection: jest.fn(async () => {}),
  getDb: jest.fn(async () => ({
    data: { logs: [], config: {}, memory: {} },
    write: async () => {}
  }))
}));

const { saveLog, updateLastLog, getRecentLogs, getAnalytics, getLogFile, resetLocks } =
  await import('../../src/core.js');
const { list: dbList, add: dbAdd } = await import('../../src/db.js');

describe('Core Logic', () => {
  const config = { storage: 'repo', userName: 'shared', moodTracking: true };

  beforeEach(() => {
    jest.clearAllMocks();
    fakeFs.__files.clear();
    // core.js memoizes resolved paths and held locks across calls.
    resetLocks();
    dbList.mockResolvedValue([]);
  });

  test('should generate and save an 8-character hex ID', async () => {
    const ok = await saveLog('test message', config);

    // The write has to actually land — safeWrite verifies size and content and
    // reports failure rather than throwing, so a bare "was writeSync called"
    // assertion would pass even against a broken write path.
    expect(ok).toBe(true);

    const written = fakeFs.__files.get(getLogFile(config));
    expect(written).toMatch(/id: [0-9a-f]{8}/);
    expect(written).toContain('test message');
  });

  test('should record the entry in the database as well as the markdown', async () => {
    await saveLog('test message', config);

    expect(dbAdd).toHaveBeenCalledWith('logs', expect.objectContaining({
      note: 'test message',
      type: 'action',
      commit: 'abc123',
      branch: 'main'
    }));
  });

  test('should retrieve logs correctly (async)', async () => {
    dbList.mockResolvedValue([
      { id: 'a1b2c3d4', note: 'Test entry', timestamp: '2026-01-01T00:00:00.000Z', type: 'action', project: 'logloop' }
    ]);

    const logs = await getRecentLogs(config, 1);
    expect(logs[0].id).toBe('a1b2c3d4');
  });

  test('should update the last log entry correctly (fs parity)', async () => {
    const logFile = getLogFile(config);
    fakeFs.__files.set(
      logFile,
      '# DevLog\n\n## [2026-01-01T00:00:00.000Z]\nid: a1b2c3d4\ntype: action\n\nOld note\n'
    );

    const ok = updateLastLog({ type: 'decision', mood: 'focused' }, config);

    expect(ok).toBe(true);
    const updated = fakeFs.__files.get(logFile);
    expect(updated).toContain('type: decision');
    expect(updated).toContain('mood: focused');
    expect(updated).toContain('Old note');
  });

  describe('getAnalytics', () => {
    it('should return null if no logs exist', async () => {
      dbList.mockResolvedValue([]);
      expect(await getAnalytics(config)).toBeNull();
    });

    it('should parse logs from db and return analytics object', async () => {
      dbList.mockResolvedValue([
        { note: 'We decided to use X.', timestamp: '2026-01-01T10:00:00.000Z', type: 'decision', mood: 'focused', project: 'logloop' },
        { note: 'Why is this broken?', timestamp: '2026-01-01T11:00:00.000Z', type: 'question', mood: 'confused', project: 'logloop' }
      ]);

      const analytics = await getAnalytics(config);

      expect(analytics).not.toBeNull();
      expect(analytics.categories.decision).toBe(1);
      expect(analytics.categories.question).toBe(1);
      expect(analytics.moods.focused).toBe(1);
      expect(analytics.moods.confused).toBe(1);
    });
  });
});
