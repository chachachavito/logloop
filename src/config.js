const fs = require('fs');
const path = require('path');

const configFile = path.join(process.cwd(), '.selflogrc');

function loadConfig() {
  if (fs.existsSync(configFile)) {
    try {
      return JSON.parse(fs.readFileSync(configFile, 'utf8'));
    } catch (e) {
      return {};
    }
  }
  return {};
}

function saveConfig(config) {
  try {
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = {
  loadConfig,
  saveConfig
};
