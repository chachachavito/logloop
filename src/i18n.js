const { loadConfig } = require('./config');

const en = require('./locales/en.json');
const pt = require('./locales/pt.json');

const locales = { en, pt };

function t(path) {
  const config = loadConfig();
  const lang = config.lang || 'en';
  const strings = locales[lang] || locales['en'];

  const parts = path.split('.');
  let value = strings;
  for (const part of parts) {
    if (value[part] === undefined) return path;
    value = value[part];
  }
  return value;
}

module.exports = { t };
