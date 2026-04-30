import { loadConfig } from './config.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const en = JSON.parse(fs.readFileSync(path.join(__dirname, './locales/en.json'), 'utf8'));
const pt = JSON.parse(fs.readFileSync(path.join(__dirname, './locales/pt.json'), 'utf8'));

const locales = { en, pt };

export function t(path) {
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
