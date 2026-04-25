const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

describe('CLI E2E: Binary Execution', () => {
  const binPath = path.join(__dirname, '../../bin/index.js');
  const testDir = path.join(os.tmpdir(), `logloop-e2e-${Date.now()}`);
  const logFile = path.join(testDir, 'logloop.md');

  beforeAll(() => {
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
    // Use 'shared' to have logloop.md as filename
    fs.writeFileSync(path.join(testDir, '.loglooprc'), JSON.stringify({
      storage: 'repo',
      userName: 'shared',
      autoCommit: false,
      moodTracking: false
    }));
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      try { fs.rmSync(testDir, { recursive: true, force: true }); } catch (e) {}
    }
  });

  const runCLI = (args = '') => {
    return execSync(`node ${binPath} ${args}`, {
      cwd: testDir,
      env: { ...process.env, LANG: 'en_US.UTF-8' },
      encoding: 'utf8'
    });
  };

  test('should show version', () => {
    const output = runCLI('--version');
    expect(output).toMatch(/logloop \d+\.\d+\.\d+/);
  });

  test('should show help', () => {
    const output = runCLI('--help');
    expect(output).toContain('Usage:');
  });

  test('should log a message via CLI arguments', () => {
    runCLI('"E2E test message"');
    const expectedLog = path.join(testDir, 'logloop.md');
    expect(fs.existsSync(expectedLog)).toBe(true);
    const content = fs.readFileSync(expectedLog, 'utf8');
    expect(content).toContain('E2E test message');
  });

  test('should list local projects', () => {
    const output = runCLI('list');
    expect(output).toContain('PROJECT');
  });

  test('should get config from local .loglooprc', () => {
    const output = runCLI('config get userName');
    expect(output).toContain('shared');
  });
});
