const fs = require('fs');
const { saveLog, getRecentLogs, updateLastLog, getStats, getDailySummary } = require('../../src/core');

jest.mock('fs');
jest.mock('../../src/git', () => ({
  getGitMetadata: () => ({ hash: 'a1b2c3d', branch: 'main' }),
  isGitRepo: () => true,
  commitLog: jest.fn().mockReturnValue(true)
}));

describe('Core Module - Log IDs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should generate and save a 4-character hex ID', () => {
    fs.existsSync.mockReturnValue(false);
    saveLog('test message');

    const writtenContent = fs.writeFileSync.mock.calls[0][1];
    expect(writtenContent).toMatch(/id: [0-9a-f]{4}/);
  });

  test('should retrieve ID correctly from log file', () => {
    const mockContent = '\n## [2026-04-24T12:00:00Z]\nid: a1b2\ntype: thought\nmood: happy\n\nTest note\n';
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(mockContent);

    const logs = getRecentLogs(1);
    expect(logs[0].id).toBe('a1b2');
  });

  test('should generate correct statistics from log content', () => {
    const mockContent = `
## [2026-04-24T10:00:00Z]
id: a1b2
type: decision
mood: happy

Decision 1

## [2026-04-24T11:00:00Z]
id: c3d4
type: action
mood: focused

Action 1
`;
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(mockContent);

    const stats = getStats(7);
    expect(stats.total).toBe(2);
    expect(stats.categories.decision).toBe(1);
    expect(stats.categories.action).toBe(1);
    expect(stats.moods.happy).toBe(1);
  });

  test('should update the last log entry correctly', () => {
    const mockContent = '\n## [2026-04-24T12:00:00Z]\nid: a1b2\ntype: thought\n\nTest note\n';
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(mockContent);
    
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

    const summary = getDailySummary();
    
    expect(summary.decisions).toContain('Decided to use Jest.');
    expect(summary.topActions).toContain('Writing tests.');
    expect(summary.mood).toBe('happy');
  });

  test('should handle extreme unicode and emojis without breaking metadata', () => {
    const complexNote = 'Zalgo: H̴e̷l̶p̸ ̷m̶e̸ and Emojis: 👨‍👩‍👧‍👦 🏳️‍🌈 🚀';
    const mockContent = `
## [2026-04-24T12:00:00Z]
id: e1f2
type: thought
mood: confused

${complexNote}
`;
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(mockContent);

    const stats = getStats(1);
    expect(stats.total).toBe(1);
    expect(stats.timeline['2026-04-24']).toBeDefined();
    
    const logs = getRecentLogs(1);
    expect(logs[0].note).toBe(complexNote);
  });
});
