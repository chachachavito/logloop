/**
 * Test sandbox.
 *
 * src/config.js and src/db.js resolve GLOBAL_DIR from os.homedir() at module
 * load time, so an unsandboxed run reads and writes the developer's real
 * ~/.logloop — and tests/unit/db.test.js unlinks db.json in beforeEach, which
 * destroys real log data.
 *
 * This has to happen in globalSetup rather than setupFiles: setupFiles run
 * inside jest's test environment, where process.env is a copy, while
 * os.homedir() reads the process's actual environment block and would not see
 * the change. globalSetup runs in the parent process before any worker is
 * forked, so the redirected HOME is inherited by every worker for real, and by
 * every child process the e2e and regression suites spawn.
 *
 * This is the outer safety net only. tests/jest.setup.mjs then narrows each
 * test file to its own store underneath this directory via LOGLOOP_HOME —
 * without that, every file would share one db.json. See the note there.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

export default function globalSetup() {
  const sandboxHome = fs.mkdtempSync(path.join(os.tmpdir(), 'logloop-test-home-'));

  process.env.HOME = sandboxHome;
  process.env.USERPROFILE = sandboxHome; // win32
  process.env.LOGLOOP_TEST_HOME = sandboxHome;

  if (os.homedir() !== sandboxHome) {
    throw new Error(
      `Test sandbox failed: os.homedir() is still ${os.homedir()}. ` +
      `Refusing to run — the suite would write to the real ~/.logloop.`
    );
  }
}
