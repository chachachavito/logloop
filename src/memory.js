import { getDb } from './db.js';

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

export function loadMemory() {
  // Nota: loadMemory agora é síncrono para compatibilidade, mas lowdb é assíncrono.
  // Como o lowdb carrega os dados no Preset, podemos tentar acessar de forma síncrona se já carregado,
  // ou refatorar para async. Para a migração gradual, manteremos o carregamento via db.data.
  // TODO: Refatorar chamadas para async se necessário.
  // Por enquanto, usaremos uma versão que assume que o DB será lido via await onde necessário.
  return DEFAULT_MEMORY; 
}

// Versão Async para o novo fluxo
export async function getMemory() {
  const db = await getDb();
  if (!db.data.memory || Object.keys(db.data.memory).length === 0) {
    db.data.memory = JSON.parse(JSON.stringify(DEFAULT_MEMORY));
    await db.write();
  }
  return db.data.memory;
}

export async function saveMemory(memory) {
  const db = await getDb();
  db.data.memory = memory;
  await db.write();
}

export async function learn(input, category, resolved, bucket = 'message') {
  const memory = await getMemory();
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
  
  await saveMemory(memory);
}

export async function exportMemory(destPath) {
  const memory = await getMemory();
  const fs = await import('fs');
  fs.writeFileSync(destPath, JSON.stringify(memory, null, 2), 'utf8');
  return true;
}

export async function importMemory(sourcePath) {
  const fs = await import('fs');
  if (!fs.existsSync(sourcePath)) return false;
  
  const current = await getMemory();
  const imported = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

  ['message', 'mood'].forEach(bucket => {
    if (!imported[bucket]) return;
    imported[bucket].mappings.forEach(impMap => {
      const existing = current[bucket].mappings.find(m => m.input === impMap.input);
      if (existing) {
        existing.count = (existing.count || 1) + (impMap.count || 1);
      } else {
        current[bucket].mappings.push(impMap);
      }
    });

    current[bucket].aliases_learned = { 
      ...current[bucket].aliases_learned, 
      ...imported[bucket].aliases_learned 
    };
  });

  await saveMemory(current);
  return true;
}
