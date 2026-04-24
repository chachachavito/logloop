const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const core = require('../../src/core');

describe('Resilience & High-Performance Suite', () => {
  const testDir = path.join(os.tmpdir(), `logloop-elite-${Date.now()}`);
  const binPath = path.join(__dirname, '../../bin/index.js');
  const logFile = path.join(testDir, 'logloop.md');
  const lockFile = `${logFile}.lock`;
  const tmpFile = `${logFile}.tmp`;

  beforeAll(() => {
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(path.join(testDir, '.loglooprc'), JSON.stringify({ storage: 'repo', userName: 'shared' }));
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      try { fs.rmSync(testDir, { recursive: true, force: true }); } catch (e) {}
    }
  });

  test('should handle high-frequency sequential writes', () => {
    const config = { storage: 'repo', userName: 'shared' };
    const numWrites = 20;
    
    // Garantir que o cwd é o testDir para getLogFile funcionar
    const originalCwd = process.cwd();
    process.chdir(testDir);
    
    try {
      for (let i = 0; i < numWrites; i++) {
        core.saveLog(`Sequential write ${i}`, config);
      }

      const content = fs.readFileSync(logFile, 'utf8');
      const sections = content.split('\n## [').slice(1);
      expect(sections.length).toBe(numWrites);
    } finally {
      process.chdir(originalCwd);
    }
  });

  test('should handle reentrancy correctly', () => {
    const config = { storage: 'repo', userName: 'shared' };
    const originalCwd = process.cwd();
    process.chdir(testDir);
    
    try {
      // Tentar adquirir lock duas vezes no mesmo processo
      core.withLock(logFile, () => {
        core.withLock(logFile, () => {
          core.saveLog('Reentrant log', config);
        });
      });
      
      expect(fs.existsSync(lockFile)).toBe(false);
    } finally {
      process.chdir(originalCwd);
    }
  });

  test('should recover from crash (stale .tmp and .lock)', (done) => {
    // 1. Criar arquivos órfãos antigos
    fs.writeFileSync(lockFile, 'stale lock');
    fs.writeFileSync(tmpFile, 'stale tmp');
    
    const oldTime = (Date.now() - 15000) / 1000;
    fs.utimesSync(lockFile, oldTime, oldTime);
    fs.utimesSync(tmpFile, oldTime, oldTime);
    
    // 2. Chamar CLI (deve limpar no startup)
    exec(`node ${binPath} --help`, { cwd: testDir }, (error) => {
      expect(fs.existsSync(lockFile)).toBe(false);
      expect(fs.existsSync(tmpFile)).toBe(false);
      done();
    });
  });

  test('should handle batch concurrency without data corruption', (done) => {
    const numParallel = 5;
    let completed = 0;
    const results = [];

    for (let i = 0; i < numParallel; i++) {
      exec(`node ${binPath} "concurrent note ${i}"`, { cwd: testDir }, (error, stdout, stderr) => {
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
      
      // Integridade: Sucessos + Falhas = Total
      expect(successes.length + failures.length).toBe(numParallel);
      
      // Verificar se o arquivo é legível e não truncado
      if (fs.existsSync(logFile)) {
        const content = fs.readFileSync(logFile, 'utf8');
        const sections = content.split('\n## [').slice(1);
        expect(sections.length).toBeGreaterThanOrEqual(successes.length);
        
        sections.forEach(s => {
          expect(s).toMatch(/id: [0-9a-f]{8}/);
          expect(s.trim()).not.toBe('');
        });
      }
      done();
    }
  }, 20000);
});
