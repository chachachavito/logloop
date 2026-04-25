/**
 * Integration Test: Manifest Alignment
 * Ensures that the code, documentation, and metadata never drift from capabilities.json
 */
const fs = require('fs');
const path = require('path');

describe('System Manifest Alignment', () => {
  const manifestPath = path.join(__dirname, '../../capabilities.json');
  const readmePath = path.join(__dirname, '../../README.md');
  const localePath = path.join(__dirname, '../../src/locales/en.json');
  const faqPath = path.join(__dirname, '../../docs/PR-FAQ.md');
  const indexPath = path.join(__dirname, '../../site/index.html');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const readme = fs.readFileSync(readmePath, 'utf8');
  const locale = JSON.parse(fs.readFileSync(localePath, 'utf8'));
  const faq = fs.readFileSync(faqPath, 'utf8');
  const index = fs.readFileSync(indexPath, 'utf8');

  test('every slash command must be documented in README.md', () => {
    manifest.slash_commands.forEach(item => {
      expect(readme).toContain(item.command);
    });
  });

  test('every slash command must have a locale entry in en.json', () => {
    manifest.slash_commands.forEach(item => {
      const found = Object.values(locale.ui).some(v => 
        typeof v === 'string' && v.startsWith(item.command)
      );
      expect(found).toBe(true);
    });
  });

  test('every core concept must be present in PR-FAQ.md and index.html', () => {
    manifest.core_concepts.forEach(concept => {
      const formatted = concept.replace(/_/g, ' ').toLowerCase();
      
      const inFaq = faq.toLowerCase().includes(formatted) || faq.includes(concept);
      const inIndex = index.toLowerCase().includes(formatted) || index.includes(concept);
      
      expect(inFaq).toBe(true);
      expect(inIndex).toBe(true);
    });
  });

  test('every semantic category must be documented in README.md', () => {
    Object.keys(manifest.log_categories).forEach(cat => {
      expect(readme).toContain(cat);
    });
  });

  test('manifest version should match package.json version', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8'));
    expect(manifest.version).toBe(pkg.version);
  });
});
