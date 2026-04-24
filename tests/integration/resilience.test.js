const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('Resilience & Concurrency Suite', () => {
  const testDir = path.join(os.tmpdir(), `logloop-resilience-${Date.now()}`);
  const binPath = path.join(__dirname, '../../bin/index.js');
  const logFile = path.join(testDir, 'logloop.md');
  const lockFile = `${logFile}.lock`;

  beforeAll(() => {
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(path.join(testDir, '.loglooprc'), JSON.stringify({ storage: 'repo', userName: 'shared' }));
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      try { fs.rmSync(testDir, { recursive: true, force: true }); } catch (e) {}
    }
  });

  test('should handle concurrency with controlled failures', (done) => {
    const numParallel = 3;
    let completed = 0;
    const results = [];

    for (let i = 0; i < numParallel; i++) {
      exec(`node ${binPath} "note ${i}"`, { cwd: testDir }, (error, stdout, stderr) => {
        results.push({ error, stdout, stderr });
        completed++;
        if (completed === numParallel) {
          verify();
        }
      });
    }

    function verify() {
      const successes = results.filter(r => !r.error);
      const failures = results.filter(r => r.error);
      
      if (failures.length > 0) {
        console.log('CONCURRENCY FAILURES (expected if locked):', failures.map(f => f.stderr).join('\n'));
      }

      expect(successes.length + failures.length).toBe(numParallel);
      
      if (fs.existsSync(logFile)) {
        const content = fs.readFileSync(logFile, 'utf8');
        const sections = content.split('\n## [').slice(1);
        expect(sections.length).toBe(successes.length);
      }
      done();
    }
  }, 15000);

  test('should fail fast if lock exists', (done) => {
    fs.writeFileSync(lockFile, 'manual-lock');
    
    exec(`node ${binPath} "should fail"`, { cwd: testDir, timeout: 5000 }, (error, stdout, stderr) => {
      try {
        expect(error).toBeDefined();
        expect(stderr + stdout).toContain('locked');
      } finally {
        if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);
        done();
      }
    });
  }, 10000);

  test('should cleanup orphan locks on startup', (done) => {
    fs.writeFileSync(lockFile, 'orphan');
    const oldTime = (Date.now() - 15000) / 1000;
    fs.utimesSync(lockFile, oldTime, oldTime);
    
    exec(`node ${binPath} --help`, { cwd: testDir }, (error, stdout, stderr) => {
      try {
        expect(fs.existsSync(lockFile)).toBe(false);
      } finally {
        done();
      }
    });
  });
});
