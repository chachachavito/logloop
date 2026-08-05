/**
 * Regression: the `decision` category carried the pattern /decisão/ (with tilde).
 *
 * normalize() runs NFD and strips the combining marks, and classifyMessage tests
 * the patterns against that normalized text — so an accented character in a
 * pattern can never match anything. "A decisão foi manter storage local" came
 * out as `thought`.
 *
 * The one-character fix ('decisão' -> 'decisao') is exactly the kind that comes
 * back, so the last test here guards the whole class rather than the instance:
 * no pattern in any category may contain a character that normalize() strips.
 */
import { classifyMessage, classifyMood } from '../../src/classifier.js';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const classifierSource = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src/classifier.js'),
  'utf8'
);

const normalize = (text) => text.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

describe('regression: classifier patterns survive diacritic normalization', () => {
  test('an accented "decisão" is classified as a decision', async () => {
    const { category } = await classifyMessage('A decisão foi manter storage local');
    expect(category).toBe('decision');
  });

  test('the unaccented spelling works too', async () => {
    const { category } = await classifyMessage('A decisao foi manter storage local');
    expect(category).toBe('decision');
  });

  test('accented and unaccented input classify identically', async () => {
    const accented = await classifyMessage('A decisão foi manter storage local');
    const plain = await classifyMessage('A decisao foi manter storage local');
    expect(accented.category).toBe(plain.category);
  });

  test('the dead pattern is gone from the source', () => {
    expect(classifierSource).not.toMatch(/decisão/);
    expect(classifierSource).toMatch(/decisao/);
  });

  test('other decision phrasings still classify correctly', async () => {
    for (const message of ['decidi usar lowdb', 'vou usar storage local', 'optei por nao versionar']) {
      expect((await classifyMessage(message)).category).toBe('decision');
    }
  });

  test('unrelated messages are not swept into `decision`', async () => {
    expect((await classifyMessage('implementando o parser de timestamp')).category).toBe('action');
    expect((await classifyMessage('por que isso quebrou?')).category).toBe('question');
  });

  /**
   * The class guard. Every regex literal inside the pattern arrays is checked
   * for characters that normalize() would strip — any such character is a
   * pattern that can never fire.
   */
  test('no pattern in any category contains a diacritic normalize() would strip', () => {
    const patternArrays = classifierSource.match(/patterns:\s*\[[\s\S]*?\]/g) || [];
    expect(patternArrays.length).toBeGreaterThan(0);

    const offenders = patternArrays.filter(block => normalize(block) !== block.toLowerCase().trim());

    expect(offenders).toEqual([]);
  });

  test('mood classification is reachable for the accent-free vocabulary it ships with', async () => {
    expect((await classifyMood('consegui resolver, funciona')).category).toBe('happy');
    expect((await classifyMood('que dificil, ta empacado')).category).toBe('frustrated');
  });
});
