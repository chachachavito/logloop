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
    const config = loadConfig(true);
    expect(config.moodTracking).toBe(true);
    expect(config.autoCommit).toBe(false);
  });

  test('should prioritize local config over default', () => {
    fs.existsSync.mockImplementation((path) => path.includes('.loglooprc'));
    fs.readFileSync.mockReturnValue(JSON.stringify({ moodTracking: false }));
    
    const config = loadConfig(true);
    expect(config.moodTracking).toBe(false);
  });

  test('should log error if directory creation fails', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    fs.existsSync.mockReturnValue(false);
    fs.mkdirSync.mockImplementation(() => { throw new Error('EACCES'); });
    
    // We re-import to trigger the immediate execution of ensureDir
    jest.isolateModules(() => {
      require('../../src/config');
    });

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('EACCES'));
    consoleSpy.mockRestore();
  });

  test('should merge global and local configs correctly', () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockImplementation((file) => {
      if (file.includes('.logloop') && file.includes('logs') === false && file.includes('.loglooprc')) {
        // Global
        if (file.startsWith('/home/user')) return JSON.stringify({ autoCommit: true, lang: 'en' });
        // Local
        return JSON.stringify({ lang: 'pt' });
      }
      return '{}';
    });

    const config = loadConfig(true);
    expect(config.autoCommit).toBe(true); // From global
    expect(config.lang).toBe('pt');        // Local overrides global
  });
});
