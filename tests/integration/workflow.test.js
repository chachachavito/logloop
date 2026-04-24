const fs = require('fs');
const path = require('path');
const os = require('os');
const { saveLog, updateLastLog, getRecentLogs } = require('../../src/core');
const { learn, loadMemory } = require('../../src/memory');

// Mocking everything to keep it fast and clean
jest.mock('fs');
jest.mock('../../src/git', () => ({
  getGitMetadata: () => ({ hash: 'abc123', branch: 'main' }),
  isGitRepo: () => true,
  commitLog: () => true
}));
jest.mock('../../src/config', () => ({
  loadConfig: () => ({ storage: 'repo', moodTracking: true, lang: 'en' }),
  GLOBAL_DIR: '/tmp/logloop-integration'
}));

describe('Integration: User Workflow', () => {
  const mockFile = path.join(process.cwd(), 'logloop.shared.md');

  beforeEach(() => {
    jest.clearAllMocks();
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue('# DevLog\n');
  });

  test('should complete a full learning cycle', () => {
    // 1. User writes a log that is misclassified
    const note = 'deploying to prod';
    saveLog(note);
    
    expect(fs.appendFileSync).toHaveBeenCalledWith(
      expect.stringContaining('logloop.md'),
      expect.stringContaining('deploying to prod'),
      'utf8'
    );

    // 2. User reclassifies as action and trains the brain
    learn('deploying to prod', 'action', 'action', 'message');
    
    // Verify memory update call (it should contain the learned mapping)
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('memory.json'),
      expect.stringContaining('deploying to prod'),
      'utf8'
    );
  });

  test('should handle IDs across saves and retrievals', () => {
    saveLog('Fix bug');
    const writtenEntry = fs.appendFileSync.mock.calls[0][1];
    const idMatch = writtenEntry.match(/id: ([0-9a-f]{4})/);
    const id = idMatch[1];

    // Mock the file content for retrieval
    fs.readFileSync.mockReturnValue(`\n## [2026-01-01]\nid: ${id}\ntype: action\n\nFix bug`);
    
    const logs = getRecentLogs(1);
    expect(logs[0].id).toBe(id);
    expect(logs[0].note).toBe('Fix bug');
  });
});
