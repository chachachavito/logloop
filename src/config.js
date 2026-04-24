const fs = require('fs');
const path = require('path');
const os = require('os');

const LOCAL_CONFIG = path.join(process.cwd(), '.loglooprc');
const GLOBAL_DIR = path.join(os.homedir(), '.logloop');
const GLOBAL_CONFIG = path.join(GLOBAL_DIR, 'config.json');

const DEFAULTS = {
  autoCommit: false,
  moodTracking: true,
  storage: 'repo', // 'repo' or 'local'
  lang: 'en'
};

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

ensureDir(GLOBAL_DIR);
ensureDir(path.join(GLOBAL_DIR, 'logs'));

function loadConfig() {
  let config = { ...DEFAULTS };

  // 1. Carregar Global
  if (fs.existsSync(GLOBAL_CONFIG)) {
    try {
      const globalData = JSON.parse(fs.readFileSync(GLOBAL_CONFIG, 'utf8'));
      config = { ...config, ...globalData };
    } catch (e) {}
  }

  // 2. Carregar Local (Projeto) - Sobrescreve Global
  if (fs.existsSync(LOCAL_CONFIG)) {
    try {
      const localData = JSON.parse(fs.readFileSync(LOCAL_CONFIG, 'utf8'));
      config = { ...config, ...localData };
    } catch (e) {}
  }

  return config;
}

function saveConfig(config, global = false) {
  const data = JSON.stringify(config, null, 2);
  if (global) {
    ensureGlobalDir();
    fs.writeFileSync(GLOBAL_CONFIG, data, 'utf8');
  } else {
    fs.writeFileSync(LOCAL_CONFIG, data, 'utf8');
  }
}

module.exports = {
  loadConfig,
  saveConfig,
  GLOBAL_DIR
};
