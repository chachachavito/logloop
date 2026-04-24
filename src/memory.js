const fs = require('fs');
const path = require('path');
const { GLOBAL_DIR } = require('./config');

const MEMORY_PATH = path.join(GLOBAL_DIR, 'memory.json');

const DEFAULT_MEMORY = {
  message: {
    aliases_static: {
      'feat': 'feature',
      'fix': 'bugfix',
      'refact': 'refactor',
      'imp': 'implementation',
      'doc': 'documentation',
      'test': 'testing'
    },
    aliases_learned: {},
    mappings: []
  },
  mood: {
    aliases_static: {},
    aliases_learned: {},
    mappings: []
  }
};

function loadMemory() {
  if (!fs.existsSync(MEMORY_PATH)) {
    return DEFAULT_MEMORY;
  }
  try {
    const data = JSON.parse(fs.readFileSync(MEMORY_PATH, 'utf8'));
    // Merge defaults with loaded data for each bucket
    return {
      message: { ...DEFAULT_MEMORY.message, ...(data.message || {}) },
      mood: { ...DEFAULT_MEMORY.mood, ...(data.mood || {}) }
    };
  } catch (e) {
    return DEFAULT_MEMORY;
  }
}

function saveMemory(memory) {
  if (!fs.existsSync(GLOBAL_DIR)) {
    fs.mkdirSync(GLOBAL_DIR, { recursive: true });
  }
  fs.writeFileSync(MEMORY_PATH, JSON.stringify(memory, null, 2), 'utf8');
}

function learn(input, category, resolved, bucket = 'message') {
  const memory = loadMemory();
  const normalized = input.toLowerCase().trim();
  
  if (!memory[bucket]) memory[bucket] = { aliases_learned: {}, mappings: [] };
  
  const existingIndex = memory[bucket].mappings.findIndex(m => m.normalized === normalized);
  
  if (existingIndex > -1) {
    memory[bucket].mappings[existingIndex].category = category;
    memory[bucket].mappings[existingIndex].resolved = resolved;
    memory[bucket].mappings[existingIndex].count = (memory[bucket].mappings[existingIndex].count || 0) + 1;
  } else {
    memory[bucket].mappings.push({
      input,
      normalized,
      category,
      resolved,
      count: 1
    });
  }
  
  saveMemory(memory);
}

module.exports = {
  loadMemory,
  saveMemory,
  learn
};
