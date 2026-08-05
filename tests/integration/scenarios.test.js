import { jest } from '@jest/globals';
import { registerUiMocks, useBufferTimers, flush, silenceOutput } from '../helpers/ui-harness.mjs';

const mocks = registerUiMocks();
const { startLoop } = await import('../../src/ui.js');

describe('Logloop Usage Scenarios', () => {
  let mockConfig;
  let restoreOutput;

  beforeEach(() => {
    jest.clearAllMocks();
    useBufferTimers();
    restoreOutput = silenceOutput();

    // Default config starting with Zen Mode enabled
    mockConfig = {
      storage: 'repo',
      autoCommit: false,
      moodTracking: false,
      zenMode: true,
      lang: 'en'
    };

    mocks.core.getRecentLogs.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
    restoreOutput();
  });

  const sendCommand = async (line) => {
    mocks.rl.emit('line', line);
    await flush();
  };

  test('Scenario 1: Starting in Zen Mode and Toggling Help', async () => {
    await startLoop(mockConfig);

    // Toggle Help with /h — zen mode is the inverse of help visibility.
    await sendCommand('/h');
    expect(mocks.config.saveConfig).toHaveBeenCalledWith(expect.objectContaining({
      zenMode: false
    }));

    // Toggle Help back with /zen
    await sendCommand('/zen');
    expect(mocks.config.saveConfig).toHaveBeenCalledWith(expect.objectContaining({
      zenMode: true
    }));
  });

  test('Scenario 2: Regular logging maintains state', async () => {
    await startLoop(mockConfig);

    mocks.rl.emit('line', 'Scenario test note');
    jest.advanceTimersByTime(50);
    await flush();

    expect(mocks.core.saveLog).toHaveBeenCalledWith(
      'Scenario test note',
      mockConfig,
      expect.any(Object)
    );

    // Ensure prompt is shown again
    expect(mocks.rl.prompt).toHaveBeenCalled();
  });

  test('Scenario 3: Changing storage preserves Zen preference', async () => {
    mockConfig.zenMode = true;
    await startLoop(mockConfig);

    await sendCommand('/s');

    // Should save new storage while keeping zenMode: true
    expect(mocks.config.saveConfig).toHaveBeenCalledWith(expect.objectContaining({
      storage: 'local',
      zenMode: true
    }));
  });

  test('Scenario 4: An unknown command is rejected without logging it', async () => {
    await startLoop(mockConfig);

    await sendCommand('/definitely-not-a-command');

    expect(mocks.core.saveLog).not.toHaveBeenCalled();
    expect(mocks.config.saveConfig).not.toHaveBeenCalled();
  });
});
