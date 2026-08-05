/**
 * Regression: `logloop config set` did not persist.
 *
 * saveConfig() is async (it awaits db.write()), but handleConfig() called it
 * without awaiting and then hit process.exit(0), killing the process before
 * lowdb flushed. The CLI printed 'Config "storage" set to local' and db.json
 * never changed.
 *
 * This has to spawn the real binary: the bug lives in the race between an
 * un-awaited write and process.exit, which no in-process unit test observes.
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const binPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../bin/index.js');

describe('regression: config set persists across processes', () => {
  let home;
  let projectDir;

  const runCLI = (...args) => {
    // lowdb's JSONFilePreset swaps JSONFile for an in-memory adapter whenever
    // NODE_ENV === 'test' (node_modules/lowdb/lib/presets/node.js), and jest
    // sets NODE_ENV=test by default. Inheriting it would mean the CLI never
    // writes db.json at all, and this test would fail against correct code
    // while proving nothing about persistence.
    const env = { ...process.env, HOME: home, USERPROFILE: home, LANG: 'en_US.UTF-8' };
    delete env.NODE_ENV;
    // The jest process sets LOGLOOP_HOME to isolate its own store; it would be
    // inherited here and win over HOME, sending the child somewhere this test
    // is not looking. Point it at the per-test home instead.
    env.LOGLOOP_HOME = path.join(home, '.logloop');

    // A dedicated HOME per test keeps GLOBAL_DIR (and db.json) off the real one.
    return execFileSync('node', [binPath, ...args], { cwd: projectDir, env, encoding: 'utf8' });
  };

  beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'logloop-cfg-home-'));
    // No .loglooprc here: loadConfig's legacy migration would otherwise supply
    // values and mask whether the write itself actually landed.
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logloop-cfg-proj-'));
  });

  afterEach(() => {
    for (const dir of [home, projectDir]) {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
    }
  });

  test('a value set in one process is visible to the next', () => {
    const setOutput = runCLI('config', 'set', 'storage', 'local');
    expect(setOutput).toContain('set to local');

    // The real assertion: a *separate* process must see it.
    expect(runCLI('config', 'get', 'storage').trim()).toBe('local');
  });

  test('the value actually reaches db.json on disk', () => {
    runCLI('config', 'set', 'storage', 'local');

    const dbPath = path.join(home, '.logloop', 'db.json');
    expect(fs.existsSync(dbPath)).toBe(true);
    expect(JSON.parse(fs.readFileSync(dbPath, 'utf8')).config.storage).toBe('local');
  });

  test('booleans are coerced and persisted, not stored as strings', () => {
    runCLI('config', 'set', 'autoCommit', 'true');

    const dbPath = path.join(home, '.logloop', 'db.json');
    expect(JSON.parse(fs.readFileSync(dbPath, 'utf8')).config.autoCommit).toBe(true);
  });

  test('successive writes each survive their own process exit', () => {
    runCLI('config', 'set', 'storage', 'local');
    runCLI('config', 'set', 'lang', 'pt');

    const saved = JSON.parse(fs.readFileSync(path.join(home, '.logloop', 'db.json'), 'utf8')).config;
    expect(saved.storage).toBe('local');
    expect(saved.lang).toBe('pt');
  });
});
