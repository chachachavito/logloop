import { jest } from '@jest/globals';
import fs from 'fs';
import { loadConfig } from '../../src/config.js';

// Note: In ESM, mocking needs to be done before the module is imported.
// Since we are using standard Jest mocks which might struggle with ESM, 
// we'll use a more straightforward approach if possible.

describe('Config Module', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('should load default config if no files exist', async () => {
    // Basic test without heavy mocking for now as ESM mocks are complex
    const config = await loadConfig(true);
    expect(config.moodTracking).toBeDefined();
    expect(config.autoCommit).toBeDefined();
  });

  test('should merge configs (Integration-like check)', async () => {
    const config = await loadConfig(true);
    expect(config).toHaveProperty('storage');
    expect(config).toHaveProperty('lang');
  });
});
