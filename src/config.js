import fs from 'fs';
import path from 'path';
import pc from 'picocolors';
import { getDb } from './db.js';
import { GLOBAL_DIR, LOGS_DIR } from './paths.js';

export { GLOBAL_DIR };
export const DEFAULTS = {
  autoCommit: false,
  moodTracking: true,
  storage: 'repo', // repo | local | mirror
  lang: 'en',
  userName: '',
  trainingMode: false,
  zenMode: true
};

let _configCache = null;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (err) {
      console.error(pc.red(`Error creating directory ${dir}: ${err.message}`));
      return false;
    }
  }
  return true;
}

let _cleanupDone = false;
function defensiveCleanup() {
  if (_cleanupDone) return;
  try {
    const currentDir = process.cwd();
    const files = fs.readdirSync(currentDir);
    const now = Date.now();
    
    files.forEach(file => {
      if ((file.endsWith('.lock') || file.endsWith('.tmp')) && file.includes('logloop')) {
        const filePath = path.join(currentDir, file);
        try { 
          const stats = fs.statSync(filePath);
          if ((now - stats.mtimeMs) > 10000) {
            fs.unlinkSync(filePath); 
          }
        } catch (e) {}
      }
    });
    _cleanupDone = true;
  } catch (e) {}
}

ensureDir(GLOBAL_DIR);
ensureDir(LOGS_DIR);
defensiveCleanup();

export async function loadConfig(forceRefresh = false) {
  if (_configCache && !forceRefresh) return _configCache;

  const db = await getDb();
  let config = { ...DEFAULTS, ...(db.data.config || {}) };

  // Migração legada: Carregar de .loglooprc se existir e o db estiver vazio
  if (Object.keys(db.data.config || {}).length === 0) {
    const globalPath = path.join(GLOBAL_DIR, '.loglooprc');
    const localPath = path.join(process.cwd(), '.loglooprc');

    if (fs.existsSync(globalPath)) {
      try {
        const globalData = JSON.parse(fs.readFileSync(globalPath, 'utf8'));
        config = { ...config, ...globalData };
      } catch (e) {}
    }

    if (fs.existsSync(localPath)) {
      try {
        const localData = JSON.parse(fs.readFileSync(localPath, 'utf8'));
        config = { ...config, ...localData };
      } catch (e) {}
    }
    
    // Persistir no novo storage
    db.data.config = config;
    await db.write();
  }

  _configCache = config;
  return config;
}

/**
 * Versão síncrona para compatibilidade com módulos que não podem ser async no topo.
 * Requer que loadConfig tenha sido chamado ao menos uma vez (no bin/index.js).
 */
export function getConfigSync() {
  return _configCache || DEFAULTS;
}

export async function saveConfig(config) {
  const db = await getDb();
  db.data.config = config;
  await db.write();
  _configCache = config;
}
