import { jest } from '@jest/globals';
import { registerUiMocks, useBufferTimers, flush, silenceOutput } from '../helpers/ui-harness.mjs';

const mocks = registerUiMocks();
const { startLoop } = await import('../../src/ui.js');

/**
 * ui.js does not save a line as soon as it arrives. It buffers lines and only
 * commits them 50ms after the last one, so a multi-line paste — which arrives
 * as a burst of 'line' events — becomes a single log entry instead of one entry
 * per line. A slash command flushes the buffer immediately rather than waiting.
 */
describe('UI Integration: Multi-line Paste Support', () => {
  let mockConfig;
  let restoreOutput;

  beforeEach(() => {
    jest.clearAllMocks();
    useBufferTimers();
    restoreOutput = silenceOutput();

    mockConfig = {
      storage: 'repo',
      userName: 'test-user',
      autoCommit: false,
      moodTracking: true,
      zenMode: true,
      lang: 'en'
    };

    mocks.core.getRecentLogs.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
    restoreOutput();
  });

  const paste = (lines) => lines.forEach(line => mocks.rl.emit('line', line));

  const settle = async () => {
    jest.advanceTimersByTime(50);
    await flush();
  };

  test('should group rapid lines into a single log entry (paste simulation)', async () => {
    await startLoop(mockConfig);

    paste(['First line of paste', 'Second line of paste', 'Third line of paste']);

    // Nothing is committed while the burst is still arriving.
    expect(mocks.core.saveLog).not.toHaveBeenCalled();

    await settle();

    expect(mocks.core.saveLog).toHaveBeenCalledTimes(1);
    expect(mocks.core.saveLog).toHaveBeenCalledWith(
      'First line of paste\nSecond line of paste\nThird line of paste',
      mockConfig,
      expect.any(Object)
    );
  });

  test('should flush buffer when a command line is received', async () => {
    await startLoop(mockConfig);

    mocks.rl.emit('line', 'Some text before command');
    mocks.rl.emit('line', '/c');
    await flush();

    expect(mocks.core.saveLog).toHaveBeenCalledWith(
      'Some text before command',
      mockConfig,
      expect.any(Object)
    );

    // The command must not leave a second, duplicate entry behind.
    await settle();
    expect(mocks.core.saveLog).toHaveBeenCalledTimes(1);
  });

  test('should handle commands mixed with pastes correctly', async () => {
    await startLoop(mockConfig);

    mocks.rl.emit('line', 'Pre-command text');
    mocks.rl.emit('line', '/c');
    await flush();

    expect(mocks.core.saveLog).toHaveBeenCalledWith(
      'Pre-command text',
      mockConfig,
      expect.any(Object)
    );

    paste(['Post-command line 1', 'Post-command line 2']);
    await settle();

    expect(mocks.core.saveLog).toHaveBeenCalledWith(
      'Post-command line 1\nPost-command line 2',
      mockConfig,
      expect.any(Object)
    );
    expect(mocks.core.saveLog).toHaveBeenCalledTimes(2);
  });

  test('should handle Word-formatted text (smart quotes, bullets, extra spacing)', async () => {
    await startLoop(mockConfig);

    paste([
      '• First item with “smart quotes”',
      '',
      '• Second item with an em-dash — cool',
      '  Indented line with multiple spaces'
    ]);
    await settle();

    expect(mocks.core.saveLog).toHaveBeenCalledWith(
      '• First item with “smart quotes”\n\n• Second item with an em-dash — cool\n  Indented line with multiple spaces',
      mockConfig,
      expect.any(Object)
    );
  });

  test('should classify the joined paste, not the individual lines', async () => {
    await startLoop(mockConfig);

    paste(['I am very', 'happy with this result']);
    await settle();

    expect(mocks.classifier.classifyMood).toHaveBeenCalledWith('I am very\nhappy with this result');
    expect(mocks.core.saveLog).toHaveBeenCalledWith(
      'I am very\nhappy with this result',
      mockConfig,
      expect.objectContaining({ mood: 'focused' })
    );
  });

  test('should not save a log entry if the paste is only whitespace', async () => {
    await startLoop(mockConfig);

    paste(['   ', '', '\n']);
    await settle();

    expect(mocks.core.saveLog).not.toHaveBeenCalled();
  });

  test('should pass a single pasted path straight through', async () => {
    await startLoop(mockConfig);

    paste(['screenshot.png']);
    await settle();

    expect(mocks.core.saveLog).toHaveBeenCalledWith(
      'screenshot.png',
      mockConfig,
      expect.any(Object)
    );
  });
});
