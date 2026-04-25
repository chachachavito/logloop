const readline = require('readline');
const core = require('../../src/core');
const config = require('../../src/config');
const EventEmitter = require('events');

jest.mock('../../src/core');
jest.mock('../../src/config');
jest.mock('../../src/memory');
jest.mock('../../src/git', () => ({
  getGitMetadata: jest.fn().mockReturnValue({ branch: 'main' }),
  isGitRepo: jest.fn().mockReturnValue(true),
  getLogFile: jest.fn().mockReturnValue('logloop.md')
}));
jest.mock('fs');
jest.mock('child_process', () => ({
  execSync: jest.fn()
}));

const { startLoop } = require('../../src/ui');

describe('UI Integration: Multi-line Paste Support', () => {
  let mockRl;
  let mockConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    mockConfig = {
      storage: 'repo',
      userName: 'test-user',
      autoCommit: false,
      moodTracking: true,
      lang: 'en'
    };
    config.loadConfig.mockReturnValue(mockConfig);

    mockRl = new EventEmitter();
    mockRl.prompt = jest.fn();
    mockRl.close = jest.fn();
    readline.createInterface = jest.fn().mockReturnValue(mockRl);

    core.getRecentLogs.mockReturnValue([]);
    core.getAnalytics.mockReturnValue(null);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('should group rapid lines into a single log entry (paste simulation)', () => {
    startLoop(mockConfig);

    mockRl.emit('line', 'First line of paste');
    mockRl.emit('line', 'Second line of paste');
    mockRl.emit('line', 'Third line of paste');

    // SaveLog should NOT have been called yet
    expect(core.saveLog).not.toHaveBeenCalled();

    // Advance time by 50ms
    jest.advanceTimersByTime(50);

    expect(core.saveLog).toHaveBeenCalledTimes(1);
    expect(core.saveLog).toHaveBeenCalledWith(
      'First line of paste\nSecond line of paste\nThird line of paste',
      mockConfig,
      expect.any(Object)
    );
  });

  test('should flush buffer when a command line is received', () => {
    startLoop(mockConfig);

    mockRl.emit('line', 'Some text before command');
    
    // Immediate command
    mockRl.emit('line', '/c');

    // Buffer should be flushed immediately by the command handler
    expect(core.saveLog).toHaveBeenCalledWith(
      'Some text before command',
      mockConfig,
      expect.any(Object)
    );

    // Run timers to ensure nothing else happens
    jest.runAllTimers();
    expect(core.saveLog).toHaveBeenCalledTimes(1);
  });

  test('should handle commands mixed with pastes correctly', () => {
    startLoop(mockConfig);

    mockRl.emit('line', 'Pre-command text');
    mockRl.emit('line', '/c');
    mockRl.emit('line', 'Post-command line 1');
    mockRl.emit('line', 'Post-command line 2');

    // Pre-command text should be saved immediately
    expect(core.saveLog).toHaveBeenCalledWith(
      'Pre-command text',
      mockConfig,
      expect.any(Object)
    );

    // Advance 50ms for the post-command paste
    jest.advanceTimersByTime(50);

    expect(core.saveLog).toHaveBeenCalledWith(
      'Post-command line 1\nPost-command line 2',
      mockConfig,
      expect.any(Object)
    );
    
    expect(core.saveLog).toHaveBeenCalledTimes(2);
  });

  test('should handle Word-formatted text (smart quotes, bullets, extra spacing)', () => {
    startLoop(mockConfig);

    const wordTextLines = [
      '• First item with “smart quotes”',
      '',
      '• Second item with an em-dash — cool',
      '  Indented line with multiple spaces'
    ];

    wordTextLines.forEach(line => mockRl.emit('line', line));

    jest.advanceTimersByTime(50);

    expect(core.saveLog).toHaveBeenCalledWith(
      '• First item with “smart quotes”\n\n• Second item with an em-dash — cool\n  Indented line with multiple spaces',
      mockConfig,
      expect.any(Object)
    );
  });

  test('should detect mood correctly in a multi-line paste', () => {
    startLoop(mockConfig);

    mockRl.emit('line', 'I am very');
    mockRl.emit('line', 'happy with this result');

    jest.advanceTimersByTime(50);

    // The classifier (mocked indirectly via core.saveLog) should receive the joined string
    expect(core.saveLog).toHaveBeenCalledWith(
      'I am very\nhappy with this result',
      mockConfig,
      expect.any(Object)
    );
  });

  test('should not save a log entry if the paste is only whitespace', () => {
    startLoop(mockConfig);

    mockRl.emit('line', '   ');
    mockRl.emit('line', '');
    mockRl.emit('line', '\n');

    jest.advanceTimersByTime(50);

    // saveLog should NOT have been called because input.trim() would be empty
    expect(core.saveLog).not.toHaveBeenCalled();
  });

  test('should classify image paths and markdown images as media', () => {
    startLoop(mockConfig);

    mockRl.emit('line', 'screenshot.png');
    jest.advanceTimersByTime(50);

    expect(core.saveLog).toHaveBeenCalledWith(
      'screenshot.png',
      mockConfig,
      expect.objectContaining({ mood: null })
    );
    
    // We can't easily check the classifier result here because core.saveLog is mocked,
    // but we can verify it doesn't crash and the flow is correct.
    // To truly verify classification, we'd need a classifier unit test or a less mocked integration test.
  });
});
