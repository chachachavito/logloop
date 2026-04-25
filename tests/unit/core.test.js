const fs = require('fs');
const { saveLog, updateLastLog, getRecentLogs } = require('../../src/core');

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
  utimesSync: jest.fn()
}));
jest.mock('../../src/git', () => ({
  getGitMetadata: () => ({ hash: 'abc123', branch: 'main' }),
  isGitRepo: () => true,
  commitLog: () => true
}));
jest.mock('../../src/classifier', () => ({
  classifyMessage: () => ({ category: 'action' })
}));

describe('Core Logic', () => {
  const config = { storage: 'repo', userName: 'shared', moodTracking: true };

  beforeEach(() => {
    jest.clearAllMocks();
    fs.readFileSync.mockReturnValue('# DevLog\n');
  });

  test('should generate and save an 8-character hex ID', () => {
    fs.existsSync.mockReturnValue(false);
    saveLog('test message', config);

    const writtenContent = fs.writeSync.mock.calls[0][1];
    expect(writtenContent).toMatch(/id: [0-9a-f]{8}/);
  });

  test('should retrieve ID correctly from log file', () => {
    const mockContent = '# DevLog\n\n## [2026-01-01T00:00:00.000Z]\nid: a1b2c3d4\ntype: action\n\nTest entry';
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(mockContent);

    const logs = getRecentLogs(config, 1);
    expect(logs[0].id).toBe('a1b2c3d4');
  });

  test('should update the last log entry correctly', () => {
    const mockContent = '# DevLog\n\n## [2026-01-01T00:00:00.000Z]\nid: a1b2c3d4\ntype: action\n\nOld note';
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(mockContent);

    updateLastLog({ type: 'decision', mood: 'focused' }, config);

    expect(fs.writeFileSync).toHaveBeenCalled();
    expect(fs.renameSync).toHaveBeenCalled();
  });

  describe('saveLog edge cases', () => {
    it('should trigger git commit when shouldCommit is true', () => {
      const git = require('../../src/git');
      jest.spyOn(git, 'commitLog');
      
      fs.readFileSync.mockImplementation((path) => {
        const writeCalls = fs.writeSync.mock.calls;
        if (writeCalls.length > 0) {
          return writeCalls[writeCalls.length - 1][1]; 
        }
        return '# DevLog\n';
      });
      let size = 1000;
      fs.statSync.mockImplementation(() => {
        size += 1000;
        return { size };
      });

      saveLog('test commit', config, { shouldCommit: true });
      expect(git.commitLog).toHaveBeenCalled();
    });

    it('should use durable write (fsync) if configured', () => {
      fs.readFileSync.mockImplementation((path) => {
        const writeCalls = fs.writeSync.mock.calls;
        if (writeCalls.length > 0) {
          return writeCalls[writeCalls.length - 1][1];
        }
        return '# DevLog\n';
      });
      let size = 1000;
      fs.statSync.mockImplementation(() => {
        size += 1000;
        return { size };
      });
      saveLog('test fsync', { ...config, durable: true });
    });
  });

  describe('getAnalytics', () => {
    const { getAnalytics } = require('../../src/core');

    it('should return null if no logs exist', () => {
      fs.existsSync.mockReturnValue(false);
      expect(getAnalytics(config)).toBeNull();
    });

    it('should parse logs and return analytics object', () => {
      const mockContent = `# DevLog
## [2026-01-01T10:00:00.000Z]
type: decision
mood: focused

We decided to use X.
## [2026-01-01T11:00:00.000Z]
type: question
mood: confused

Why is this broken?`;
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(mockContent);

      const analytics = getAnalytics(config);
      
      expect(analytics).not.toBeNull();
      expect(analytics.categories.decision).toBe(1);
      expect(analytics.categories.question).toBe(1);
      expect(analytics.moods.focused).toBe(1);
      expect(analytics.moods.confused).toBe(1);
      expect(analytics.decisions).toContain('We decided to use X.');
      expect(analytics.questions).toContain('Why is this broken?');
      
      const hour1 = new Date('2026-01-01T10:00:00.000Z').getHours();
      const hour2 = new Date('2026-01-01T11:00:00.000Z').getHours();
      expect(analytics.timeline[hour1]).toBe(1);
      expect(analytics.timeline[hour2]).toBe(1);
    });
  });
});
