const fs = require('fs');
const { loadConfig, GLOBAL_DIR, GLOBAL_CONFIG } = require('../../src/config');

jest.mock('fs');
jest.mock('os', () => ({
  homedir: () => '/home/user'
}));

describe('Config Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should load default config if no files exist', () => {
    fs.existsSync.mockReturnValue(false);
    const config = loadConfig();
    expect(config.moodTracking).toBe(true);
    expect(config.autoCommit).toBe(false);
  });

  test('should prioritize local config over default', () => {
    fs.existsSync.mockImplementation((path) => path.includes('.loglooprc'));
    fs.readFileSync.mockReturnValue(JSON.stringify({ moodTracking: false }));
    
    const config = loadConfig();
    expect(config.moodTracking).toBe(false);
  });

  test('should merge global and local configs correctly', () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockImplementation((path) => {
      if (path.includes('config.json')) {
        return JSON.stringify({ autoCommit: true, lang: 'en' });
      }
      if (path.includes('.loglooprc')) {
        return JSON.stringify({ lang: 'pt' });
      }
      return '{}';
    });

    const config = loadConfig();
    expect(config.autoCommit).toBe(true); // From global
    expect(config.lang).toBe('pt');        // Local overrides global
  });
});
