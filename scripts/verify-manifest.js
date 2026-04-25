/**
 * Validation Script: Manifest Alignment
 * Ensures README.md, locales, and capabilities.json are in sync.
 */
const fs = require('fs');
const path = require('path');

const manifestPath = path.join(__dirname, '../capabilities.json');
const readmePath = path.join(__dirname, '../README.md');
const faqPath = path.join(__dirname, '../docs/PR-FAQ.md');
const indexPath = path.join(__dirname, '../site/index.html');
const localePath = path.join(__dirname, '../src/locales/en.json');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const readme = fs.readFileSync(readmePath, 'utf8');
const faq = fs.readFileSync(faqPath, 'utf8');
const index = fs.readFileSync(indexPath, 'utf8');
const locale = JSON.parse(fs.readFileSync(localePath, 'utf8'));

let errors = 0;

console.log(`\n🔍 Validating Logloop Manifest (v${manifest.version})...\n`);

// 1. Verify Slash Commands
manifest.slash_commands.forEach(item => {
  // Check README
  if (!readme.includes(item.command)) {
    console.error(`❌ Command ${item.command} missing in README.md`);
    errors++;
  }

  // Check Locale
  let foundLocale = false;
  Object.keys(locale.ui).forEach(key => {
    if (locale.ui[key].startsWith(item.command)) foundLocale = true;
  });
  if (!foundLocale) {
    console.error(`❌ Command ${item.command} missing in locales/en.json`);
    errors++;
  }

  // Check FAQ (marketing/strategy check)
  if (item.command === '/t' && !faq.includes('Training')) {
     console.warn(`⚠️ Training Mode (/t) not mentioned in PR-FAQ.md`);
  }

  console.log(`✅ Validated command: ${item.command}`);
});

// 2. Verify Concepts and Categories in Site/FAQ
manifest.core_concepts.forEach(concept => {
  if (!index.includes(concept) && !index.toLowerCase().includes(concept.replace(/_/g, ' '))) {
    console.warn(`⚠️ Core concept '${concept}' missing from Landing Page (index.html)`);
  }
  if (!faq.includes(concept) && !faq.toLowerCase().includes(concept.replace(/_/g, ' '))) {
    console.warn(`⚠️ Core concept '${concept}' missing from PR-FAQ.md`);
  }
});

// 3. Verify Categories
Object.keys(manifest.log_categories).forEach(cat => {
  if (!readme.includes(cat)) errors++;
});

if (errors === 0) {
  console.log('\n✨ ALL FILES 100% ALIGNED WITH MANIFEST ✨\n');
  process.exit(0);
} else {
  console.log(`\n❌ Validation failed with ${errors} errors.\n`);
  process.exit(1);
}
