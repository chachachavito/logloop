const fs = require('fs');
const { saveLog, getRecentLogs, getStats } = require('../../src/core');

jest.mock('fs');
jest.mock('../../src/git', () => ({
  getGitMetadata: () => ({ hash: 'abc', branch: 'main' }),
  isGitRepo: () => true,
  commitLog: () => true
}));

describe('Core Module - Log IDs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should generate and save a 4-character hex ID', () => {
    fs.existsSync.mockReturnValue(true);
    
    saveLog('test message');

    const writtenContent = fs.appendFileSync.mock.calls[0][1];
    expect(writtenContent).toMatch(/id: [0-9a-f]{4}/);
  });

  test('should retrieve ID correctly from log file', () => {
    const mockContent = `
## [2026-04-24T19:00:00.000Z]
id: a1b2
commit: abc
branch: main
type: action

test note
`;
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(mockContent);

    const logs = getRecentLogs(1);
    expect(logs[0].id).toBe('a1b2');
  });

  test('should generate correct statistics from log content', () => {
    const mockContent = `
## [2026-04-24T10:00:00.000Z]
id: a1b2
type: action
mood: happy

## [2026-04-24T11:00:00.000Z]
id: c3d4
type: decision
mood: happy
`;
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(mockContent);

    const stats = getStats(1);
    expect(stats.total).toBe(2);
    expect(stats.categories.action).toBe(1);
    expect(stats.categories.decision).toBe(1);
    expect(stats.moods.happy).toBe(2);
    expect(stats.timeline['2026-04-24'].count).toBe(2);
  });

  test('should update the last log entry correctly', () => {
    const mockContent = `\n## [2026-01-01]\nid: a1b2\ntype: action\n\nOld message`;
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(mockContent);
    
    const { updateLastLog } = require('../../src/core');
    updateLastLog({ type: 'decision', mood: 'excited' });

    const rewritten = fs.writeFileSync.mock.calls[0][1];
    expect(rewritten).toContain('type: decision');
    expect(rewritten).toContain('mood: excited');
  });

  test('should generate a correct daily summary', () => {
    const today = new Date().toISOString().split('T')[0];
    const mockContent = `
## [${today}T10:00:00Z]
id: a1b2
type: decision
mood: happy

Decided to use Jest.

## [${today}T11:00:00Z]
id: c3d4
type: action
mood: focused

Writing tests.
`;
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(mockContent);

    const { getDailySummary } = require('../../src/core');
    const summary = getDailySummary();
    
    expect(summary.decisions).toContain('Decided to use Jest.');
    expect(summary.topActions).toContain('Writing tests.');
    expect(summary.mood).toBe('happy');
  });
});
