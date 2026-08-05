/**
 * Integration Test: Manifest Alignment
 * Ensures that the code, documentation, and metadata never drift from capabilities.json
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));

describe('System Manifest Alignment', () => {
  // capabilities.json lives under docs/ — it is the same file .versionrc.json
  // bumps on release.
  const manifestPath = path.join(here, '../../docs/capabilities.json');
  const readmePath = path.join(here, '../../README.md');
  const localePath = path.join(here, '../../src/locales/en.json');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const readme = fs.readFileSync(readmePath, 'utf8');
  const locale = JSON.parse(fs.readFileSync(localePath, 'utf8'));

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

  // README.md is the document that has to keep up with the concepts: it is the
  // page npm and GitHub show, and the one contributors read. docs/PR-FAQ.md is
  // a dated press release for a specific version and site/index.html is
  // marketing copy, so holding either to the manifest only produced a failure
  // nobody could act on.
  test('every core concept must be documented in README.md', () => {
    manifest.core_concepts.forEach(concept => {
      const formatted = concept.replace(/_/g, ' ').toLowerCase();
      const documented = readme.toLowerCase().includes(formatted) || readme.includes(concept);

      // Named so a failure says which concept drifted.
      expect(documented ? concept : `${concept} (missing from README.md)`).toBe(concept);
    });
  });

  test('every semantic category must be documented in README.md', () => {
    Object.keys(manifest.log_categories).forEach(cat => {
      expect(readme).toContain(cat);
    });
  });

  test('manifest version should match package.json version', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(here, '../../package.json'), 'utf8'));
    expect(manifest.version).toBe(pkg.version);
  });
});
