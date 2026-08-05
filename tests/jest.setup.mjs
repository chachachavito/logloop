/**
 * Per-test-file store isolation.
 *
 * tests/jest.globalSetup.mjs redirects HOME for the whole run, which keeps the
 * suite off the developer's real ~/.logloop. That alone is not enough: every
 * test file then shares one db.json, and each file gets its own module registry
 * — so each holds a separate lowdb instance with its own steno Writer, all
 * staging writes through the same .db.json.tmp. Two files writing near each
 * other produce an ENOENT on rename, and config written by one file leaks into
 * another (an e2e run would read the repo's own .loglooprc userName instead of
 * its fixture).
 *
 * src/paths.js honours LOGLOOP_HOME, and unlike os.homedir() it reads
 * process.env from JavaScript — so it does see writes made here, inside jest's
 * test environment. Pointing each file at its own directory underneath the
 * sandbox gives real isolation, and child processes spawned by the e2e and
 * regression suites inherit it.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

const sandboxHome = process.env.LOGLOOP_TEST_HOME;

if (!sandboxHome) {
  throw new Error('Test sandbox missing: globalSetup did not run. Refusing to touch the real home directory.');
}

// Tripwire: if HOME ever resolves back to the real home directory, fail at
// import time rather than let a test unlink the real ~/.logloop/db.json.
if (os.homedir() !== sandboxHome) {
  throw new Error(
    `Test sandbox breached: os.homedir() is ${os.homedir()}, expected ${sandboxHome}.`
  );
}

process.env.LOGLOOP_HOME = fs.mkdtempSync(path.join(sandboxHome, 'store-'));

// lowdb's JSONFilePreset silently swaps JSONFile for an in-memory adapter when
// NODE_ENV === 'test' (node_modules/lowdb/lib/presets/node.js), and jest sets
// NODE_ENV=test by default. Leaving it set means no test exercises real
// persistence, and resetting state by unlinking db.json does nothing at all.
delete process.env.NODE_ENV;
