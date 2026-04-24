const fs = require('fs');
const path = require('path');
const os = require('os');

const GLOBAL_DIR = path.join(os.homedir(), '.logloop');
const DEFAULTS = {
  autoCommit: false,
  moodTracking: true,
  storage: 'repo',
  lang: 'en',
  userName: ''
};

let _configCache = null;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (err) {
      console.error(`\x1b[31mError creating directory ${dir}: ${err.message}\x1b[0m`);
      return false;
    }
  }
  return true;
}

function defensiveCleanup() {
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
  } catch (e) {}
}

ensureDir(GLOBAL_DIR);
ensureDir(path.join(GLOBAL_DIR, 'logs'));
defensiveCleanup();

function loadConfig(forceRefresh = false) {
  if (_configCache && !forceRefresh) return _configCache;

  let config = { ...DEFAULTS };
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

  _configCache = config;
  return config;
}

function saveConfig(config) {
  const globalPath = path.join(GLOBAL_DIR, '.loglooprc');
  fs.writeFileSync(globalPath, JSON.stringify(config, null, 2));
  _configCache = config;
}

module.exports = { loadConfig, saveConfig, GLOBAL_DIR, DEFAULTS };
