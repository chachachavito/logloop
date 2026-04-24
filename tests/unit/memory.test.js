const fs = require('fs');
const { loadMemory, learn } = require('../../src/memory');
const { GLOBAL_DIR } = require('../../src/config');
const path = require('path');

jest.mock('fs');
jest.mock('../../src/config', () => ({
  GLOBAL_DIR: '/tmp/logloop-test'
}));

describe('Memory Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should load default memory if file does not exist', () => {
    fs.existsSync.mockReturnValue(false);
    const memory = loadMemory();
    expect(memory.message.mappings).toEqual([]);
    expect(memory.mood.mappings).toEqual([]);
  });

  test('should fallback to default memory if JSON is corrupted', () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue('invalid-json-content');
    const memory = loadMemory();
    expect(memory.message.mappings).toEqual([]);
  });

  test('should learn a new mapping and save to file', () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify({
      message: { aliases_static: {}, aliases_learned: {}, mappings: [] },
      mood: { aliases_static: {}, aliases_learned: {}, mappings: [] }
    }));

    learn('test message', 'action', 'action', 'message');

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('memory.json'),
      expect.stringContaining('test message'),
      'utf8'
    );
  });

  test('should increment count if mapping already exists', () => {
    const existingMemory = {
      message: { 
        aliases_static: {}, 
        aliases_learned: {}, 
        mappings: [{ input: 'test', normalized: 'test', category: 'action', resolved: 'action', count: 1 }] 
      },
      mood: { aliases_static: {}, aliases_learned: {}, mappings: [] }
    };
    
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify(existingMemory));

    learn('test', 'action', 'action', 'message');

    const savedData = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
    expect(savedData.message.mappings[0].count).toBe(2);
  });

  test('should export memory correctly', () => {
    const memory = { test: true };
    fs.readFileSync.mockReturnValue(JSON.stringify(memory));
    fs.existsSync.mockReturnValue(true);

    const { exportMemory } = require('../../src/memory');
    exportMemory('/tmp/out.json');

    expect(fs.writeFileSync).toHaveBeenCalledWith('/tmp/out.json', expect.any(String), 'utf8');
  });

  test('should merge memory during import correctly', () => {
    const currentMemory = {
      message: { mappings: [{ input: 'old', count: 1 }], aliases_learned: {} },
      mood: { mappings: [], aliases_learned: {} }
    };
    const importedMemory = {
      message: { mappings: [{ input: 'old', count: 2 }, { input: 'new', count: 1 }], aliases_learned: { a: 'b' } },
      mood: { mappings: [], aliases_learned: {} }
    };

    fs.existsSync.mockReturnValue(true);
    // First call for loadMemory (current), second for importMemory (imported)
    fs.readFileSync
      .mockReturnValueOnce(JSON.stringify(currentMemory))
      .mockReturnValueOnce(JSON.stringify(importedMemory));

    const { importMemory } = require('../../src/memory');
    importMemory('/tmp/in.json');

    const lastWrite = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
    expect(lastWrite.message.mappings.find(m => m.input === 'old').count).toBe(3);
    expect(lastWrite.message.mappings.find(m => m.input === 'new')).toBeDefined();
    expect(lastWrite.message.aliases_learned.a).toBe('b');
  });
});
