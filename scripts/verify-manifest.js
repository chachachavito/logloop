/**
 * Validation Script: Manifest Alignment
 * Ensures README.md, locales, and capabilities.json are in sync.
 */
const fs = require('fs');
const path = require('path');

const manifestPath = path.join(__dirname, '../capabilities.json');
const readmePath = path.join(__dirname, '../README.md');
const localePath = path.join(__dirname, '../src/locales/en.json');

if (!fs.existsSync(manifestPath)) {
  console.error('❌ Manifest not found');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const readme = fs.readFileSync(readmePath, 'utf8');
const locale = JSON.parse(fs.readFileSync(localePath, 'utf8'));

let errors = 0;

console.log(`\n🔍 Validating Logloop Manifest (v${manifest.version})...\n`);

// 1. Verify Slash Commands
manifest.slash_commands.forEach(item => {
  // Check README
  if (!readme.includes(item.command)) {
    console.error(`❌ Command ${item.command} missing in README.md`);
    errors++;
  } else {
    console.log(`✅ README: ${item.command}`);
  }

  // Check Locale
  const localeKey = 'cmd' + item.command.slice(1).charAt(0).toUpperCase() + item.command.slice(2);
  // Special handling for brain commands or multi-word
  let found = false;
  Object.keys(locale.ui).forEach(key => {
    if (locale.ui[key].startsWith(item.command)) found = true;
  });

  if (!found) {
    console.error(`❌ Command ${item.command} missing in locales/en.json`);
    errors++;
  } else {
    console.log(`✅ Locale: ${item.command}`);
  }
});

// 2. Verify Categories
Object.keys(manifest.log_categories).forEach(cat => {
  if (!readme.includes(cat)) {
    console.warn(`⚠️ Category '${cat}' might not be documented in README.md`);
  }
});

if (errors === 0) {
  console.log('\n✨ ALL FILES 100% ALIGNED WITH MANIFEST ✨\n');
  process.exit(0);
} else {
  console.log(`\n❌ Validation failed with ${errors} errors.\n`);
  process.exit(1);
}
