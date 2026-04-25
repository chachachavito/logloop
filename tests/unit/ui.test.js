const { startLoop } = require('../../src/ui');
const readline = require('readline');
const core = require('../../src/core');
const configModule = require('../../src/config');
const memory = require('../../src/memory');
const { execSync } = require('child_process');

jest.mock('readline');
jest.mock('../../src/core');
jest.mock('../../src/config');
jest.mock('../../src/memory');
jest.mock('../../src/classifier', () => ({
  classifyMessage: () => ({ category: 'action' }),
  classifyMood: () => ({ category: 'focused' })
}));
jest.mock('../../src/git', () => ({
  getGitMetadata: () => ({ branch: 'main' })
}));
jest.mock('../../src/i18n', () => ({
  t: (k) => k
}));
jest.mock('child_process', () => ({
  execSync: jest.fn()
}));

describe('ui.js unit tests', () => {
  let mockRl;
  const config = { storage: 'repo', moodTracking: true, trainingMode: false, autoCommit: false };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockRl = {
      on: jest.fn(),
      prompt: jest.fn(),
      close: jest.fn(),
      question: jest.fn()
    };
    readline.createInterface.mockReturnValue(mockRl);
    core.getRecentLogs.mockReturnValue([]);
    // Mock process.exit to prevent test runner from exiting
    jest.spyOn(process, 'exit').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    process.exit.mockRestore();
  });

  it('should start the loop and register line handler', () => {
    startLoop(config);
    expect(readline.createInterface).toHaveBeenCalled();
    expect(mockRl.on).toHaveBeenCalledWith('line', expect.any(Function));
  });

  it('should toggle trainingMode with /t', () => {
    startLoop(config);
    const lineHandler = mockRl.on.mock.calls.find(call => call[0] === 'line')[1];
    
    lineHandler('/t');
    expect(configModule.saveConfig).toHaveBeenCalledWith(expect.objectContaining({ trainingMode: true }));
  });

  it('should enter training flow when trainingMode is ON', () => {
    const trainingConfig = { ...config, trainingMode: true };
    startLoop(trainingConfig);
    const lineHandler = mockRl.on.mock.calls.find(call => call[0] === 'line')[1];

    lineHandler('test note');
    jest.advanceTimersByTime(100); // Flush buffer

    // Check first question (TYPE)
    expect(mockRl.question).toHaveBeenCalledWith(expect.stringContaining('TYPE'), expect.any(Function));
    
    // Trigger callback for TYPE
    const typeCallback = mockRl.question.mock.calls[0][1];
    typeCallback('2'); // decision

    // Check second question (MOOD)
    expect(mockRl.question).toHaveBeenCalledWith(expect.stringContaining('MOOD'), expect.any(Function));
    
    // Trigger callback for MOOD
    const moodCallback = mockRl.question.mock.calls[1][1];
    moodCallback(''); // keep default (focused)

    expect(memory.learn).toHaveBeenCalledWith('test note', 'decision', 'decision', 'message');
    expect(core.saveLog).toHaveBeenCalledWith('test note', expect.anything(), expect.objectContaining({
      type: 'decision',
      mood: 'focused'
    }));
  });

  it('should quit with /q', () => {
    startLoop(config);
    const lineHandler = mockRl.on.mock.calls.find(call => call[0] === 'line')[1];
    lineHandler('/q');
    expect(mockRl.close).toHaveBeenCalled();
  });

  it('should handle /as command', () => {
    core.getRecentLogs.mockReturnValue([{ note: 'test', type: 'thought' }]);
    startLoop(config);
    const lineHandler = mockRl.on.mock.calls.find(call => call[0] === 'line')[1];
    
    lineHandler('/as decision');
    expect(core.updateLastLog).toHaveBeenCalledWith({ type: 'decision' }, expect.anything());
    expect(memory.learn).toHaveBeenCalledWith('test', 'decision', 'decision', 'message');
  });

  it('should handle /feel command', () => {
    core.getRecentLogs.mockReturnValue([{ note: 'test', mood: 'neutral' }]);
    startLoop(config);
    const lineHandler = mockRl.on.mock.calls.find(call => call[0] === 'line')[1];
    
    lineHandler('/feel happy');
    expect(core.updateLastLog).toHaveBeenCalledWith({ mood: 'happy' }, expect.anything());
    expect(memory.learn).toHaveBeenCalledWith('test', 'happy', 'happy', 'mood');
  });

  it('should handle /timeline command', () => {
    core.getAnalytics.mockReturnValue({ timeline: [1,0], moods: {}, decisions: [], questions: [], categories: {} });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    startLoop(config);
    const lineHandler = mockRl.on.mock.calls.find(call => call[0] === 'line')[1];
    
    lineHandler('/timeline');
    expect(core.getAnalytics).toHaveBeenCalled();
    console.log.mockRestore();
  });

  it('should handle /summary command', () => {
    core.getAnalytics.mockReturnValue({ timeline: [], moods: { focused: 1 }, decisions: ['decided X'], questions: ['why?'], categories: {} });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    startLoop(config);
    const lineHandler = mockRl.on.mock.calls.find(call => call[0] === 'line')[1];
    
    lineHandler('/summary');
    expect(core.getAnalytics).toHaveBeenCalled();
    console.log.mockRestore();
  });

  it('should handle /brain-in and /brain-out commands', () => {
    memory.exportMemory.mockReturnValue(true);
    memory.importMemory.mockReturnValue(true);
    startLoop(config);
    const lineHandler = mockRl.on.mock.calls.find(call => call[0] === 'line')[1];
    
    lineHandler('/brain-out /tmp/mem.json');
    expect(memory.exportMemory).toHaveBeenCalledWith('/tmp/mem.json');

    lineHandler('/brain-in /tmp/mem.json');
    expect(memory.importMemory).toHaveBeenCalledWith('/tmp/mem.json');
  });

  it('should handle /e command to open editor', () => {
    process.env.EDITOR = 'nano';
    execSync.mockClear();
    startLoop(config);
    const lineHandler = mockRl.on.mock.calls.find(call => call[0] === 'line')[1];
    
    lineHandler('/e');
    expect(execSync).toHaveBeenCalledWith(expect.stringContaining('nano'), expect.anything());
  });
});
