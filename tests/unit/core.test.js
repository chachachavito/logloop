import { jest } from '@jest/jest';
import fs from 'fs';
import { saveLog, updateLastLog, getRecentLogs, getAnalytics } from '../../src/core.js';

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  appendFileSync: jest.fn(),
  writeSync: jest.fn(),
  fsyncSync: jest.fn(),
  closeSync: jest.fn(),
  renameSync: jest.fn(),
  openSync: jest.fn(() => 1),
  unlinkSync: jest.fn(),
  realpathSync: jest.fn(p => p),
  mkdirSync: jest.fn(),
  statSync: jest.fn(() => ({ size: 0 })),
  utimesSync: jest.fn(),
  readdirSync: jest.fn(() => [])
}));

jest.mock('../../src/git.js', () => ({
  getGitMetadata: () => ({ hash: 'abc123', branch: 'main' }),
  isGitRepo: () => true,
  commitLog: () => true
}));

jest.mock('../../src/classifier.js', () => ({
  classifyMessage: async () => ({ category: 'action' }),
  classifyMood: async () => ({ category: 'neutral' })
}));

jest.mock('../../src/db.js', () => ({
  add: async () => true,
  list: async () => [],
  getDb: async () => ({ data: { logs: [], config: {}, memory: {} }, write: async () => {} })
}));

describe('Core Logic', () => {
  const config = { storage: 'repo', userName: 'shared', moodTracking: true };

  beforeEach(() => {
    jest.clearAllMocks();
    fs.readFileSync.mockReturnValue('# DevLog\n');
  });

  test('should generate and save an 8-character hex ID', async () => {
    fs.existsSync.mockReturnValue(false);
    await saveLog('test message', config);

    // Verificamos se houve escrita no FS (markdown)
    const writtenContent = fs.writeSync.mock.calls[0][1];
    expect(writtenContent).toMatch(/id: [0-9a-f]{8}/);
  });

  test('should retrieve logs correctly (async)', async () => {
    const { list: dbList } = await import('../../src/db.js');
    dbList.mockResolvedValue([
      { id: 'a1b2c3d4', note: 'Test entry', timestamp: '2026-01-01T00:00:00.000Z', type: 'action', project: 'logloop' }
    ]);

    const logs = await getRecentLogs(config, 1);
    expect(logs[0].id).toBe('a1b2c3d4');
  });

  test('should update the last log entry correctly (fs parity)', async () => {
    const mockContent = '# DevLog\n\n## [2026-01-01T00:00:00.000Z]\nid: a1b2c3d4\ntype: action\n\nOld note';
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(mockContent);

    updateLastLog({ type: 'decision', mood: 'focused' }, config);

    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  describe('getAnalytics', () => {
    it('should return null if no logs exist', async () => {
      const { list: dbList } = await import('../../src/db.js');
      dbList.mockResolvedValue([]);
      expect(await getAnalytics(config)).toBeNull();
    });

    it('should parse logs from db and return analytics object', async () => {
      const { list: dbList } = await import('../../src/db.js');
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
