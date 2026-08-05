/**
 * Regression: getMonotonicTimestamp produced an unparseable ISO string.
 *
 * toISOString() already returns the fractional seconds and the Z, but the code
 * stripped the Z and appended '.' + counter + 'Z', yielding two fractions in
 * one timestamp: 2026-08-05T12:10:41.819.000Z. new Date() on that is Invalid
 * Date, so `logloop list` printed "Invalid Date" under LAST UPDATED.
 *
 * The broken values were written to the .md files and to lowdb, and those .md
 * files live inside users' git repos — so the fix is a tolerant reader
 * (parseLogTimestamp) rather than a rewrite of existing data. These tests pin
 * both halves: the writer emits valid ISO, and the reader still understands
 * everything written before it.
 */
import fs from 'fs';
import path from 'path';
import { saveLog, getRecentLogs, getAnalytics, parseLogTimestamp, resetLocks } from '../../src/core.js';
import { LOGS_DIR } from '../../src/paths.js';

const LEGACY = '2026-08-05T12:10:41.819.000Z';   // what 0.7.3 wrote
const CURRENT = '2026-08-05T12:10:41.819000Z';   // what the fix writes

describe('regression: log timestamps are valid ISO 8601', () => {
  describe('the writer', () => {
    const config = { storage: 'local', userName: 'tsspec', moodTracking: false };
    // Resolved through src/paths.js rather than rebuilt from os.homedir(), so
    // the test looks wherever core.js actually writes.
    const logsDir = () => LOGS_DIR;
    const logFile = () => path.join(logsDir(), `${path.basename(process.cwd())}.tsspec.md`);

    beforeAll(() => {
      // src/config.js creates this at import time, but this suite only imports
      // core.js. Without the directory, withLock's openSync fails with ENOENT,
      // which it cannot distinguish from contention — it spins for a second and
      // then reports a misleading LOCK_TIMEOUT.
      fs.mkdirSync(logsDir(), { recursive: true });
    });

    beforeEach(() => {
      resetLocks();
      try { fs.unlinkSync(logFile()); } catch {}
      try { fs.unlinkSync(logFile() + '.lock'); } catch {}
    });

    const writtenTimestamps = () =>
      (fs.readFileSync(logFile(), 'utf8').match(/^## \[(.+)\]$/gm) || [])
        .map(line => line.replace(/^## \[|\]$/g, ''));

    test('writes a timestamp new Date() can parse', async () => {
      await saveLog('primeira entrada', config);

      const [timestamp] = writtenTimestamps();
      expect(timestamp).toBeDefined();
      expect(new Date(timestamp).toString()).not.toBe('Invalid Date');
    });

    test('writes exactly one fractional part, six digits wide', async () => {
      await saveLog('segunda entrada', config);

      const [timestamp] = writtenTimestamps();
      // The 0.7.3 format (…819.000Z) fails this: it has two fractions.
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/);
    });

    test('keeps entries distinct and ordered inside the same millisecond', async () => {
      await saveLog('a', config);
      await saveLog('b', config);
      await saveLog('c', config);

      const written = writtenTimestamps();
      expect(written).toHaveLength(3);
      expect(new Set(written).size).toBe(3);
      // Lexicographic order must still equal chronological order — the whole
      // point of the monotonic counter living inside the fraction.
      expect([...written].sort()).toEqual(written);
      written.forEach(ts => expect(new Date(ts).toString()).not.toBe('Invalid Date'));
    });

    test('logs written now are readable back through getRecentLogs', async () => {
      await saveLog('entrada legivel', config);

      const [log] = await getRecentLogs(config, 1);
      expect(log.time).not.toBe('--:--');
      expect(log.time).toMatch(/^\d{2}:\d{2}$/);
    });
  });

  describe('the reader (backward compatibility)', () => {
    test('parses the legacy double-fraction format, preserving milliseconds', () => {
      const parsed = parseLogTimestamp(LEGACY);

      expect(parsed).toBeInstanceOf(Date);
      expect(parsed.toISOString()).toBe('2026-08-05T12:10:41.819Z');
    });

    test('parses the current format', () => {
      expect(parseLogTimestamp(CURRENT).toISOString()).toBe('2026-08-05T12:10:41.819Z');
    });

    test('reads both formats as the same instant', () => {
      expect(parseLogTimestamp(LEGACY).getTime()).toBe(parseLogTimestamp(CURRENT).getTime());
    });

    test('parses plain ISO written by other code paths', () => {
      expect(parseLogTimestamp('2026-01-01T00:00:00.000Z').toISOString()).toBe('2026-01-01T00:00:00.000Z');
    });

    test('returns null rather than an Invalid Date for junk or missing values', () => {
      [undefined, null, '', 'not a date', {}, 42].forEach(value =>
        expect(parseLogTimestamp(value)).toBeNull()
      );
    });

    test('legacy and current timestamps still sort chronologically as strings', () => {
      const mixed = [
        '2026-08-05T12:10:41.819000Z',
        '2026-08-05T12:10:40.100.000Z',
        '2026-08-05T12:10:42.000000Z',
        '2026-08-05T12:10:41.819.000Z',
      ];

      const byString = [...mixed].sort();
      const byInstant = [...mixed].sort(
        (a, b) => parseLogTimestamp(a) - parseLogTimestamp(b) || a.localeCompare(b)
      );

      expect(byString).toEqual(byInstant);
    });
  });

  describe('legacy entries still reach the analytics views', () => {
    test('getAnalytics bins a legacy timestamp into the right hour', async () => {
      const legacyLog = { rawTime: LEGACY, timestamp: LEGACY, type: 'decision', mood: 'neutral', note: 'entrada antiga' };

      const analytics = await getAnalytics({}, [legacyLog]);

      const expectedHour = parseLogTimestamp(LEGACY).getHours();
      expect(analytics.timeline[expectedHour]).toBe(1);
      expect(analytics.timeline.reduce((a, b) => a + b, 0)).toBe(1);
      expect(analytics.decisions).toEqual(['entrada antiga']);
    });

    test('a log with no timestamp at all does not throw or corrupt the timeline', async () => {
      const analytics = await getAnalytics({}, [{ type: 'thought', note: 'sem timestamp' }]);

      expect(analytics.timeline.reduce((a, b) => a + b, 0)).toBe(0);
      expect(analytics.categories.thought).toBe(1);
    });
  });
});
