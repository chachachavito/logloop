const readline = require('readline');
const core = require('../../src/core');
const config = require('../../src/config');
const memory = require('../../src/memory');
const fs = require('fs');
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

describe('UI Integration: Command Loop', () => {
  let mockRl;
  let mockConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Mock Config
    mockConfig = {
      storage: 'repo',
      userName: 'test-user',
      autoCommit: false,
      moodTracking: true,
      lang: 'en'
    };
    config.loadConfig.mockReturnValue(mockConfig);

    // Mock Readline
    mockRl = new EventEmitter();
    mockRl.prompt = jest.fn();
    mockRl.close = jest.fn();
    readline.createInterface = jest.fn().mockReturnValue(mockRl);

    // Mock Core
    core.getRecentLogs.mockReturnValue([]);
    core.getAnalytics.mockReturnValue({
      timeline: new Array(24).fill(0),
      categories: {},
      moods: {},
      questions: [],
      decisions: []
    });
    core.getLogFile.mockReturnValue('logloop.md');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('should toggle auto-commit with /c', () => {
    startLoop(mockConfig);
    mockRl.emit('line', '/c');
    jest.runAllTimers();
    
    expect(mockRl.prompt).toHaveBeenCalled();
  });

  test('should toggle storage with /s and save config', () => {
    startLoop(mockConfig);
    mockRl.emit('line', '/s');
    jest.runAllTimers();
    
    expect(config.saveConfig).toHaveBeenCalledWith(expect.objectContaining({
      storage: 'local'
    }));
  });

  test('should handle reclassification with /as', () => {
    const mockLogs = [{ note: 'initial note', time: '10:00', type: 'thought' }];
    core.getRecentLogs.mockReturnValue(mockLogs);
    
    startLoop(mockConfig);
    mockRl.emit('line', '/as action');
    jest.runAllTimers();
    
    expect(core.updateLastLog).toHaveBeenCalledWith({ type: 'action' }, mockConfig);
    expect(memory.learn).toHaveBeenCalledWith('initial note', 'action', 'action', 'message');
  });

  test('should handle mood correction with /feel', () => {
    const mockLogs = [{ note: 'happy note', time: '10:00', type: 'thought', mood: 'neutral' }];
    core.getRecentLogs.mockReturnValue(mockLogs);
    
    startLoop(mockConfig);
    mockRl.emit('line', '/feel happy');
    jest.runAllTimers();
    
    expect(core.updateLastLog).toHaveBeenCalledWith({ mood: 'happy' }, mockConfig);
    expect(memory.learn).toHaveBeenCalledWith('happy note', 'happy', 'happy', 'mood');
  });

  test('should export brain with /brain-out', () => {
    startLoop(mockConfig);
    mockRl.emit('line', '/brain-out backup.json');
    jest.runAllTimers();
    
    expect(memory.exportMemory).toHaveBeenCalledWith('backup.json');
  });

  test('should import brain with /brain-in', () => {
    startLoop(mockConfig);
    mockRl.emit('line', '/brain-in sync.json');
    jest.runAllTimers();
    
    expect(memory.importMemory).toHaveBeenCalledWith('sync.json');
  });

  test('should save regular notes', () => {
    startLoop(mockConfig);
    mockRl.emit('line', 'New feature implemented');
    jest.runAllTimers();
    
    expect(core.saveLog).toHaveBeenCalledWith(
      'New feature implemented', 
      mockConfig, 
      expect.objectContaining({ mood: null })
    );
  });
});
