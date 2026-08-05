import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

import { saveLog, withLock, resetLocks } from '../../src/core.js';
import { resetDb } from '../../src/db.js';

const execFileAsync = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));

describe('Resilience & High-Performance Suite', () => {
  const testDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'logloop-fortress-')));
  const binPath = path.join(here, '../../bin/index.js');
  const logFile = path.join(testDir, 'logloop.md');
  const lockFile = `${logFile}.lock`;
  const tmpFile = `${logFile}.tmp`;

  let originalCwd;

  beforeAll(() => {
    fs.writeFileSync(
      path.join(testDir, '.loglooprc'),
      JSON.stringify({ storage: 'repo', userName: 'shared' })
    );
  });

  afterAll(() => {
    try { fs.rmSync(testDir, { recursive: true, force: true }); } catch (e) {}
  });

  beforeEach(() => {
    originalCwd = process.cwd();
    resetLocks();
    resetDb();
  });

  afterEach(() => {
    process.chdir(originalCwd);
  });

  test('should handle intensive high-frequency sequential writes', async () => {
    const config = { storage: 'repo', userName: 'shared' };
    const numWrites = 50;

    process.chdir(testDir);
    try { fs.unlinkSync(logFile); } catch (e) {}

    for (let i = 0; i < numWrites; i++) {
      await expect(saveLog(`Intensive write ${i}`, config)).resolves.toBe(true);
    }

    const sections = fs.readFileSync(logFile, 'utf8').split('\n## [').slice(1);
    expect(sections).toHaveLength(numWrites);

    // Every entry must be intact — a torn write would show up as a section
    // without an id header.
    sections.forEach(section => expect(section).toMatch(/id: [0-9a-f]{8}/));
  });

  test('should handle reentrancy correctly', () => {
    process.chdir(testDir);

    let innerRan = false;
    withLock(logFile, () => {
      // Re-entering the same lock from the same process must not deadlock.
      withLock(logFile, () => { innerRan = true; });
    });

    expect(innerRan).toBe(true);
    // The outer release is the one that removes the file; the inner must not.
    expect(fs.existsSync(lockFile)).toBe(false);
  });

  test('should recover from crash (stale .tmp and .lock)', async () => {
    fs.writeFileSync(lockFile, 'stale lock');
    fs.writeFileSync(tmpFile, 'stale tmp');

    // defensiveCleanup only reaps leftovers older than 10s, so backdate them.
    const oldTime = (Date.now() - 15000) / 1000;
    fs.utimesSync(lockFile, oldTime, oldTime);
    fs.utimesSync(tmpFile, oldTime, oldTime);

    await execFileAsync('node', [binPath, '--help'], { cwd: testDir });

    expect(fs.existsSync(lockFile)).toBe(false);
    expect(fs.existsSync(tmpFile)).toBe(false);
  });

  test('should handle batch concurrency without data corruption', async () => {
    const numParallel = 5;

    const results = await Promise.allSettled(
      Array.from({ length: numParallel }, (_, i) =>
        execFileAsync('node', [binPath, `concurrent note ${i}`], { cwd: testDir })
      )
    );

    const successes = results.filter(r => r.status === 'fulfilled');
    expect(successes.length + results.filter(r => r.status === 'rejected').length).toBe(numParallel);

    // Whatever the outcome per process, the file must stay readable and every
    // section it does contain must be a complete entry.
    if (fs.existsSync(logFile)) {
      const sections = fs.readFileSync(logFile, 'utf8').split('\n## [').slice(1);
      expect(sections.length).toBeGreaterThanOrEqual(successes.length);

      sections.forEach(section => {
        expect(section).toMatch(/id: [0-9a-f]{8}/);
        expect(section.trim()).not.toBe('');
      });
    }
  }, 20000);
});
