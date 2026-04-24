const fs = require('fs');
const path = require('path');
const { saveLog, getRecentLogs } = require('../../src/core');
const { learn } = require('../../src/memory');

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
  statSync: jest.fn()
}));
jest.mock('../../src/git', () => ({
  getGitMetadata: () => ({ hash: 'abc123', branch: 'main' }),
  isGitRepo: () => true,
  commitLog: () => true
}));

describe('Integration: User Workflow', () => {
  const config = { storage: 'repo', userName: 'shared', moodTracking: true };

  beforeEach(() => {
    jest.clearAllMocks();
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue('# DevLog\n');
  });

  test('should complete a full learning cycle', () => {
    const note = 'deploying to prod';
    saveLog(note, config);
    
    expect(fs.appendFileSync).toHaveBeenCalledWith(
      expect.stringContaining('logloop.md'),
      expect.stringContaining('deploying to prod'),
      'utf8'
    );

    learn('deploying to prod', 'action', 'action', 'message');
    
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('memory.json'),
      expect.stringContaining('deploying to prod'),
      'utf8'
    );
  });

  test('should handle IDs across saves and retrievals', () => {
    saveLog('Fix bug', config);
    const writtenEntry = fs.appendFileSync.mock.calls[0][1];
    const idMatch = writtenEntry.match(/id: ([0-9a-f]{8})/);
    const id = idMatch[1];

    fs.readFileSync.mockReturnValue(`\n## [2026-01-01]\nid: ${id}\ntype: action\n\nFix bug`);
    
    const logs = getRecentLogs(config, 1);
    expect(logs[0].id).toBe(id);
    expect(logs[0].note).toBe('Fix bug');
  });
});
