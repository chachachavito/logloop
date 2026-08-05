import path from 'path';
import os from 'os';

/**
 * Where logloop keeps everything it owns.
 *
 * config.js and db.js used to derive this independently, which meant two
 * modules each held their own idea of the store location and only agreed by
 * coincidence. It lives here once now.
 *
 * LOGLOOP_HOME overrides the default. That makes the store relocatable — useful
 * for keeping separate profiles, and what the test suite uses to give each test
 * file its own store instead of sharing a single db.json.
 *
 * Resolved once at import: a process should not change its store mid-run.
 */
export const GLOBAL_DIR = process.env.LOGLOOP_HOME
  ? path.resolve(process.env.LOGLOOP_HOME)
  : path.join(os.homedir(), '.logloop');

/** Per-project markdown logs, used by the 'local' and 'mirror' strategies. */
export const LOGS_DIR = path.join(GLOBAL_DIR, 'logs');

/** The lowdb store. */
export const DB_PATH = path.join(GLOBAL_DIR, 'db.json');
