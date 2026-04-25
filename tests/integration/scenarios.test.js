const readline = require('readline');
const core = require('../../src/core');
const config = require('../../src/config');
const EventEmitter = require('events');

jest.mock('../../src/core');
jest.mock('../../src/config');
jest.mock('../../src/git', () => ({
  getGitMetadata: jest.fn().mockReturnValue({ branch: 'main' }),
  isGitRepo: jest.fn().mockReturnValue(true),
  getLogFile: jest.fn().mockReturnValue('logloop.md')
}));

const { startLoop } = require('../../src/ui');

describe('Logloop Usage Scenarios', () => {
  let mockRl;
  let mockConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Default config starting with Zen Mode enabled
    mockConfig = {
      storage: 'repo',
      autoCommit: false,
      zenMode: true,
      lang: 'en'
    };
    config.loadConfig.mockReturnValue(mockConfig);

    // Mock Readline
    mockRl = new EventEmitter();
    mockRl.prompt = jest.fn();
    mockRl.close = jest.fn();
    mockRl.question = jest.fn();
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

  test('Scenario 1: Starting in Zen Mode and Toggling Help', () => {
    startLoop(mockConfig);
    
    // Toggle Help with /h
    mockRl.emit('line', '/h');
    jest.runAllTimers();
    
    // Should persist that Zen Mode is now OFF
    expect(config.saveConfig).toHaveBeenCalledWith(expect.objectContaining({
      zenMode: false
    }));

    // Toggle Help back with /zen
    mockRl.emit('line', '/zen');
    jest.runAllTimers();
    
    // Should persist that Zen Mode is now ON again
    expect(config.saveConfig).toHaveBeenCalledWith(expect.objectContaining({
      zenMode: true
    }));
  });

  test('Scenario 2: Regular logging maintains state', () => {
    startLoop(mockConfig);
    
    // Log a message
    mockRl.emit('line', 'Scenario test note');
    jest.runAllTimers();
    
    expect(core.saveLog).toHaveBeenCalledWith(
      'Scenario test note',
      mockConfig,
      expect.any(Object)
    );
    
    // Ensure prompt is shown again
    expect(mockRl.prompt).toHaveBeenCalled();
  });

  test('Scenario 3: Changing storage preserves Zen preference', () => {
    mockConfig.zenMode = true;
    startLoop(mockConfig);
    
    // Change storage
    mockRl.emit('line', '/s');
    jest.runAllTimers();
    
    // Should save new storage while keeping zenMode: true
    expect(config.saveConfig).toHaveBeenCalledWith(expect.objectContaining({
      storage: 'local',
      zenMode: true
    }));
  });
});
