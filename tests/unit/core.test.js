const fs = require('fs');
const { saveLog, updateLastLog, getRecentLogs } = require('../../src/core');

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  appendFileSync: jest.fn(),
  renameSync: jest.fn(),
  openSync: jest.fn(),
  unlinkSync: jest.fn(),
  realpathSync: jest.fn(p => p),
  mkdirSync: jest.fn(),
  statSync: jest.fn(),
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
  });

  test('should generate and save an 8-character hex ID', () => {
    fs.existsSync.mockReturnValue(false);
    saveLog('test message', config);

    // Agora usa appendFileSync sob Lock
    const writtenContent = fs.appendFileSync.mock.calls[0][1];
    expect(writtenContent).toMatch(/id: [0-9a-f]{8}/);
  });

  test('should retrieve ID correctly from log file', () => {
    const mockContent = '# DevLog\n\n## [2026-01-01]\nid: a1b2c3d4\ntype: action\n\nTest entry';
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(mockContent);

    const logs = getRecentLogs(config, 1);
    expect(logs[0].id).toBe('a1b2c3d4');
  });

  test('should update the last log entry correctly', () => {
    const mockContent = '# DevLog\n\n## [2026-01-01]\nid: a1b2c3d4\ntype: action\n\nOld note';
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(mockContent);

    updateLastLog({ type: 'decision' }, config);

    // updateLastLog usa escrita atômica (writeFileSync + renameSync)
    const writtenContent = fs.writeFileSync.mock.calls[0][1];
    expect(writtenContent).toContain('type: decision');
    expect(fs.renameSync).toHaveBeenCalled();
  });
});
