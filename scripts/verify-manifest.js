/**
 * Validation Script: Manifest Alignment UI v2
 * Ensures README.md, locales, index.html, and PR-FAQ.md are in sync.
 */
const fs = require('fs');
const path = require('path');

const paths = {
  manifest: path.join(__dirname, '../capabilities.json'),
  readme: path.join(__dirname, '../README.md'),
  faq: path.join(__dirname, '../docs/PR-FAQ.md'),
  index: path.join(__dirname, '../site/index.html'),
  locale: path.join(__dirname, '../src/locales/en.json')
};

const manifest = JSON.parse(fs.readFileSync(paths.manifest, 'utf8'));
const readme = fs.readFileSync(paths.readme, 'utf8');
const faq = fs.readFileSync(paths.faq, 'utf8');
const index = fs.readFileSync(paths.index, 'utf8');
const locale = JSON.parse(fs.readFileSync(paths.locale, 'utf8'));

const results = {
  commands: [],
  concepts: [],
  categories: []
};

let errors = 0;

// 1. Validate Commands
manifest.slash_commands.forEach(item => {
  const inReadme = readme.includes(item.command);
  const inLocale = Object.values(locale.ui).some(v => typeof v === 'string' && v.startsWith(item.command));
  
  if (!inReadme || !inLocale) errors++;
  results.commands.push({ name: item.command, readme: inReadme, locale: inLocale });
});

// 2. Validate Concepts
manifest.core_concepts.forEach(concept => {
  const formatted = concept.replace(/_/g, ' ').toLowerCase();
  const inFAQ = faq.toLowerCase().includes(formatted) || faq.includes(concept);
  const inIndex = index.toLowerCase().includes(formatted) || index.includes(concept);
  
  if (!inFAQ || !inIndex) errors++;
  results.concepts.push({ name: concept, faq: inFAQ, index: inIndex });
});

// 3. Validate Categories
Object.keys(manifest.log_categories).forEach(cat => {
  const inReadme = readme.includes(cat);
  if (!inReadme) errors++;
  results.categories.push({ name: cat, readme: inReadme });
});

// UI RENDERING
const log = console.log;
const clr = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  bgGreen: "\x1b[42m\x1b[30m",
  bgRed: "\x1b[41m\x1b[37m"
};

const check = (val) => val ? `${clr.green}OK${clr.reset}` : `${clr.red}MISSING${clr.reset}`;

log(`\n${clr.bright}${clr.cyan}LOGLOOP MANIFEST VALIDATOR${clr.reset} [v${manifest.version}]`);
log(`${clr.cyan}────────────────────────────────────────────────────────────${clr.reset}`);

log(`\n${clr.bright}1. SLASH COMMANDS${clr.reset}`);
log(`   COMMAND        README     LOCALE`);
results.commands.forEach(c => {
  log(`   ${c.name.padEnd(14)} ${check(c.readme).padEnd(16)} ${check(c.locale)}`);
});

log(`\n${clr.bright}2. CORE CONCEPTS${clr.reset}`);
log(`   CONCEPT                          PR-FAQ     INDEX.HTML`);
results.concepts.forEach(c => {
  const shortName = c.name.length > 30 ? c.name.slice(0, 27) + '...' : c.name;
  log(`   ${shortName.padEnd(32)} ${check(c.faq).padEnd(16)} ${check(c.index)}`);
});

log(`\n${clr.bright}3. SEMANTIC CATEGORIES${clr.reset}`);
log(`   CATEGORY       README`);
results.categories.forEach(c => {
  log(`   ${c.name.padEnd(14)} ${check(c.readme)}`);
});

log(`\n${clr.cyan}────────────────────────────────────────────────────────────${clr.reset}`);
if (errors === 0) {
  log(`\n   ${clr.bgGreen}  ✨ PASS  ✨  ${clr.reset} ${clr.green}All systems 100% aligned with capabilities.json${clr.reset}\n`);
  process.exit(0);
} else {
  log(`\n   ${clr.bgRed}  ❌ FAIL  ❌  ${clr.reset} ${clr.red}Detected ${errors} alignment errors. Update content files!${clr.reset}\n`);
  process.exit(1);
}
