/**
 * Shared harness for the suites that drive src/ui.js startLoop().
 *
 * Four suites (unit/ui, integration/ui, integration/paste, integration/scenarios)
 * all need the same thing: readline replaced by an EventEmitter they can emit
 * 'line' on, and ui.js's collaborators stubbed. Under ESM there is no automock,
 * so every one of those modules needs an explicit factory registered *before*
 * src/ui.js is imported — which is what registerUiMocks() does. Call it at the
 * top level of a test file, then `await import('../../src/ui.js')`.
 *
 * startLoop and processInput are both async, so emitting a line only queues the
 * work. Tests must `await flush()` before asserting.
 */
import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

/**
 * Let queued promise callbacks run.
 *
 * setImmediate has to be left unfaked by the caller (see useBufferTimers) —
 * it is the only reliable way to get behind an async chain of unknown depth.
 */
export const flush = () => new Promise(resolve => setImmediate(resolve));

/**
 * Fake only the timers ui.js schedules on, so flush() keeps working.
 *
 * ui.js debounces pasted lines with setTimeout(flushBuffer, 50); tests need to
 * control that clock. They also need real setImmediate to await the async work
 * the flush kicks off, so it stays out of the fake.
 */
export function useBufferTimers() {
  jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });
}

export function registerUiMocks() {
  const state = { rl: null };

  const createInterface = jest.fn(() => {
    const rl = new EventEmitter();
    rl.prompt = jest.fn();
    rl.close = jest.fn();
    rl.question = jest.fn();
    state.rl = rl;
    return rl;
  });

  const readlineMock = { createInterface };

  const core = {
    saveLog: jest.fn(async () => true),
    getRecentLogs: jest.fn(async () => []),
    updateLastLog: jest.fn(() => true),
    getAnalytics: jest.fn(async () => ({
      timeline: new Array(24).fill(0),
      categories: {},
      moods: {},
      questions: [],
      decisions: []
    })),
    getLogFile: jest.fn(() => 'logloop.md'),
    getGlobalLogs: jest.fn(async () => []),
    parseLogTimestamp: jest.fn(value => (value ? new Date(value) : null))
  };

  const config = {
    saveConfig: jest.fn(async () => {}),
    loadConfig: jest.fn(async () => ({})),
    GLOBAL_DIR: '/tmp/logloop-test'
  };

  const memory = {
    learn: jest.fn(async () => {}),
    exportMemory: jest.fn(async () => true),
    importMemory: jest.fn(async () => true)
  };

  const git = {
    getGitMetadata: jest.fn(() => ({ branch: 'main', hash: 'abc1234' })),
    isGitRepo: jest.fn(() => true),
    commitLog: jest.fn(() => true)
  };

  // Deterministic by default. Suites that care about a specific classification
  // override these per test rather than depending on the real heuristics.
  const classifier = {
    classifyMessage: jest.fn(async () => ({ category: 'action' })),
    classifyMood: jest.fn(async () => ({ category: 'focused' }))
  };

  const i18n = { t: jest.fn(k => k) };

  const execSync = jest.fn();

  jest.unstable_mockModule('readline', () => ({ ...readlineMock, default: readlineMock }));
  jest.unstable_mockModule('child_process', () => ({ execSync, default: { execSync } }));
  jest.unstable_mockModule('../../src/core.js', () => core);
  jest.unstable_mockModule('../../src/config.js', () => config);
  jest.unstable_mockModule('../../src/memory.js', () => memory);
  jest.unstable_mockModule('../../src/git.js', () => git);
  jest.unstable_mockModule('../../src/classifier.js', () => classifier);
  jest.unstable_mockModule('../../src/i18n.js', () => i18n);

  return {
    core,
    config,
    memory,
    git,
    classifier,
    i18n,
    execSync,
    readline: readlineMock,
    /** The interface handed to the most recent startLoop() call. */
    get rl() { return state.rl; }
  };
}

/**
 * Silence the screen painting startLoop does on every refresh.
 * Returns a restore function.
 */
export function silenceOutput() {
  const write = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  return () => {
    write.mockRestore();
    log.mockRestore();
  };
}
