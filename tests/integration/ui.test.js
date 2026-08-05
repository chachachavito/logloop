import { jest } from '@jest/globals';
import { registerUiMocks, useBufferTimers, flush, silenceOutput } from '../helpers/ui-harness.mjs';

const mocks = registerUiMocks();
const { startLoop } = await import('../../src/ui.js');

describe('UI Integration: Command Loop', () => {
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

  const sendCommand = async (line) => {
    mocks.rl.emit('line', line);
    await flush();
  };

  const sendNote = async (line) => {
    mocks.rl.emit('line', line);
    jest.advanceTimersByTime(50); // the paste buffer debounce
    await flush();
  };

  test('should toggle auto-commit with /c', async () => {
    await startLoop(mockConfig);
    await sendCommand('/c');

    // /c is session-only state, so the observable effect is the redraw...
    expect(mocks.rl.prompt).toHaveBeenCalled();
    // ...and specifically that it is not persisted.
    expect(mocks.config.saveConfig).not.toHaveBeenCalled();
  });

  test('should carry the toggled auto-commit into the next saved log', async () => {
    await startLoop(mockConfig);
    await sendCommand('/c');
    await sendNote('note after toggle');

    expect(mocks.core.saveLog).toHaveBeenCalledWith(
      'note after toggle',
      mockConfig,
      expect.objectContaining({ shouldCommit: true })
    );
  });

  test('should toggle storage with /s and save config', async () => {
    await startLoop(mockConfig);
    await sendCommand('/s');

    expect(mocks.config.saveConfig).toHaveBeenCalledWith(expect.objectContaining({
      storage: 'local'
    }));
  });

  test('should handle reclassification with /as', async () => {
    mocks.core.getRecentLogs.mockResolvedValue([{ note: 'initial note', time: '10:00', type: 'thought' }]);

    await startLoop(mockConfig);
    await sendCommand('/as action');

    expect(mocks.core.updateLastLog).toHaveBeenCalledWith({ type: 'action' }, mockConfig);
    expect(mocks.memory.learn).toHaveBeenCalledWith('initial note', 'action', 'action', 'message');
  });

  test('should handle mood correction with /feel', async () => {
    mocks.core.getRecentLogs.mockResolvedValue([{ note: 'happy note', time: '10:00', type: 'thought', mood: 'neutral' }]);

    await startLoop(mockConfig);
    await sendCommand('/feel happy');

    expect(mocks.core.updateLastLog).toHaveBeenCalledWith({ mood: 'happy' }, mockConfig);
    expect(mocks.memory.learn).toHaveBeenCalledWith('happy note', 'happy', 'happy', 'mood');
  });

  test('should export brain with /brain-out', async () => {
    await startLoop(mockConfig);
    await sendCommand('/brain-out backup.json');

    expect(mocks.memory.exportMemory).toHaveBeenCalledWith('backup.json');
  });

  test('should import brain with /brain-in', async () => {
    await startLoop(mockConfig);
    await sendCommand('/brain-in sync.json');

    expect(mocks.memory.importMemory).toHaveBeenCalledWith('sync.json');
  });

  test('should save regular notes, classifying mood when tracking is on', async () => {
    await startLoop(mockConfig);
    await sendNote('New feature implemented');

    expect(mocks.classifier.classifyMood).toHaveBeenCalledWith('New feature implemented');
    expect(mocks.core.saveLog).toHaveBeenCalledWith(
      'New feature implemented',
      mockConfig,
      expect.objectContaining({ mood: 'focused' })
    );
  });

  test('should leave mood null when mood tracking is off', async () => {
    mockConfig.moodTracking = false;
    await startLoop(mockConfig);
    await sendNote('New feature implemented');

    expect(mocks.classifier.classifyMood).not.toHaveBeenCalled();
    expect(mocks.core.saveLog).toHaveBeenCalledWith(
      'New feature implemented',
      mockConfig,
      expect.objectContaining({ mood: null })
    );
  });

  test('should refresh the recent-log list after saving', async () => {
    await startLoop(mockConfig);
    mocks.core.getRecentLogs.mockClear();

    await sendNote('something worth logging');

    expect(mocks.core.getRecentLogs).toHaveBeenCalledWith(mockConfig, 3);
  });
});
