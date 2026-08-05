import { jest } from '@jest/globals';
import { registerUiMocks, useBufferTimers, flush, silenceOutput } from '../helpers/ui-harness.mjs';

const mocks = registerUiMocks();
const { startLoop } = await import('../../src/ui.js');

describe('ui.js unit tests', () => {
  const baseConfig = { storage: 'repo', moodTracking: true, trainingMode: false, autoCommit: false, zenMode: true };
  let config;
  let restoreOutput;

  beforeEach(() => {
    jest.clearAllMocks();
    useBufferTimers();
    restoreOutput = silenceOutput();
    config = { ...baseConfig };
    mocks.core.getRecentLogs.mockResolvedValue([]);
    jest.spyOn(process, 'exit').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    restoreOutput();
    process.exit.mockRestore();
  });

  /** Send a slash command and let its async handler settle. */
  const sendCommand = async (line) => {
    mocks.rl.emit('line', line);
    await flush();
  };

  it('should start the loop and register line handler', async () => {
    await startLoop(config);
    expect(mocks.readline.createInterface).toHaveBeenCalled();
    expect(mocks.rl.listenerCount('line')).toBe(1);
  });

  it('should toggle trainingMode with /t', async () => {
    await startLoop(config);
    await sendCommand('/t');

    expect(mocks.config.saveConfig).toHaveBeenCalledWith(expect.objectContaining({ trainingMode: true }));
  });

  it('should enter training flow when trainingMode is ON', async () => {
    config.trainingMode = true;
    await startLoop(config);

    mocks.rl.emit('line', 'test note');
    jest.advanceTimersByTime(50); // flush the paste buffer
    await flush();

    // First question: TYPE, pre-filled with the classifier's guess.
    expect(mocks.rl.question).toHaveBeenCalledWith(expect.stringContaining('TYPE'), expect.any(Function));

    const typeCallback = mocks.rl.question.mock.calls[0][1];
    await typeCallback('2'); // decision

    expect(mocks.rl.question).toHaveBeenCalledWith(expect.stringContaining('MOOD'), expect.any(Function));

    const moodCallback = mocks.rl.question.mock.calls[1][1];
    await moodCallback(''); // keep the detected mood (focused)
    await flush();

    // Only the corrected axis is learned: the type was overridden, the mood was not.
    expect(mocks.memory.learn).toHaveBeenCalledWith('test note', 'decision', 'decision', 'message');
    expect(mocks.memory.learn).toHaveBeenCalledTimes(1);

    expect(mocks.core.saveLog).toHaveBeenCalledWith('test note', config, expect.objectContaining({
      type: 'decision',
      mood: 'focused'
    }));
  });

  it('should quit with /q', async () => {
    await startLoop(config);
    await sendCommand('/q');

    expect(mocks.rl.close).toHaveBeenCalled();
  });

  it('should handle /as command', async () => {
    mocks.core.getRecentLogs.mockResolvedValue([{ note: 'test', type: 'thought' }]);
    await startLoop(config);
    await sendCommand('/as decision');

    expect(mocks.core.updateLastLog).toHaveBeenCalledWith({ type: 'decision' }, config);
    expect(mocks.memory.learn).toHaveBeenCalledWith('test', 'decision', 'decision', 'message');
  });

  it('should refuse /as when there is no log to train on', async () => {
    mocks.core.getRecentLogs.mockResolvedValue([]);
    await startLoop(config);
    await sendCommand('/as decision');

    expect(mocks.core.updateLastLog).not.toHaveBeenCalled();
    expect(mocks.memory.learn).not.toHaveBeenCalled();
  });

  it('should handle /feel command', async () => {
    mocks.core.getRecentLogs.mockResolvedValue([{ note: 'test', mood: 'neutral' }]);
    await startLoop(config);
    await sendCommand('/feel happy');

    expect(mocks.core.updateLastLog).toHaveBeenCalledWith({ mood: 'happy' }, config);
    expect(mocks.memory.learn).toHaveBeenCalledWith('test', 'happy', 'happy', 'mood');
  });

  it('should handle /timeline command', async () => {
    await startLoop(config);
    await sendCommand('/timeline');

    expect(mocks.core.getAnalytics).toHaveBeenCalled();
  });

  it('should handle /summary command', async () => {
    mocks.core.getAnalytics.mockResolvedValue({
      timeline: [], moods: { focused: 1 }, decisions: ['decided X'], questions: ['why?'], categories: {}
    });
    await startLoop(config);
    await sendCommand('/summary');

    expect(mocks.core.getAnalytics).toHaveBeenCalled();
  });

  it('should handle /brain-in and /brain-out commands', async () => {
    await startLoop(config);

    await sendCommand('/brain-out /tmp/mem.json');
    expect(mocks.memory.exportMemory).toHaveBeenCalledWith('/tmp/mem.json');

    await sendCommand('/brain-in /tmp/mem.json');
    expect(mocks.memory.importMemory).toHaveBeenCalledWith('/tmp/mem.json');
  });

  it('should handle /e command to open editor', async () => {
    process.env.EDITOR = 'nano';
    await startLoop(config);
    await sendCommand('/e');

    expect(mocks.execSync).toHaveBeenCalledWith(expect.stringContaining('nano'), expect.anything());
  });
});
