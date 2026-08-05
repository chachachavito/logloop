/**
 * End-to-end-ish workflow: real core, real memory, real lowdb, real filesystem.
 *
 * The previous version of this file mocked fs wholesale and asserted that
 * learn() wrote a memory.json — a file the module stopped using when memory
 * moved into the lowdb store. Running against the real store instead keeps the
 * test honest about what a save actually produces.
 *
 * HOME is the sandbox from tests/jest.globalSetup.mjs, so ~/.logloop here is
 * disposable. Each test runs from its own temporary project directory, which
 * also isolates it by project slug: core keys logs off basename(cwd).
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

import { saveLog, getRecentLogs, resetLocks } from '../../src/core.js';
import { learn, getMemory } from '../../src/memory.js';
import { resetDb } from '../../src/db.js';

describe('Integration: User Workflow', () => {
  const config = { storage: 'repo', userName: 'shared', moodTracking: true };
  let projectDir;
  let originalCwd;

  beforeEach(() => {
    originalCwd = process.cwd();
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logloop-workflow-'));
    process.chdir(projectDir);
    resetLocks();
    resetDb();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(projectDir, { recursive: true, force: true });
    resetDb();
  });

  const logFile = () => path.join(fs.realpathSync(projectDir), 'logloop.md');

  test('should write a note to the markdown log and the database', async () => {
    const note = 'deploying to prod';

    await expect(saveLog(note, config)).resolves.toBe(true);

    const content = fs.readFileSync(logFile(), 'utf8');
    expect(content).toContain(note);
    expect(content).toMatch(/id: [0-9a-f]{8}/);

    const logs = await getRecentLogs(config, 5);
    expect(logs).toHaveLength(1);
    expect(logs[0].note).toBe(note);
  });

  test('should complete a full learning cycle', async () => {
    const note = 'deploying to prod';
    await saveLog(note, config);

    await learn(note, 'action', 'action', 'message');

    const memory = await getMemory();
    const mapping = memory.message.mappings.find(m => m.input === note);
    expect(mapping).toMatchObject({ category: 'action', resolved: 'action', count: 1 });
  });

  test('should handle IDs across saves and retrievals', async () => {
    await saveLog('Fix bug', config);

    const written = fs.readFileSync(logFile(), 'utf8');
    const id = written.match(/id: ([0-9a-f]{8})/)[1];

    const logs = await getRecentLogs(config, 1);
    expect(logs[0].id).toBe(id);
    expect(logs[0].note).toBe('Fix bug');
  });

  test('should keep entries distinct and ordered across several saves', async () => {
    await saveLog('first note', config);
    await saveLog('second note', config);
    await saveLog('third note', config);

    const sections = fs.readFileSync(logFile(), 'utf8').split('\n## [').slice(1);
    expect(sections).toHaveLength(3);

    const ids = sections.map(s => s.match(/id: ([0-9a-f]{8})/)[1]);
    expect(new Set(ids).size).toBe(3);

    const logs = await getRecentLogs(config, 5);
    expect(logs.map(l => l.note)).toEqual(['first note', 'second note', 'third note']);
  });

  test('should not leak logs between projects', async () => {
    await saveLog('note in first project', config);

    const otherDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logloop-workflow-other-'));
    try {
      process.chdir(otherDir);
      const logs = await getRecentLogs(config, 5);
      expect(logs).toHaveLength(0);
    } finally {
      process.chdir(projectDir);
      fs.rmSync(otherDir, { recursive: true, force: true });
    }
  });
});
