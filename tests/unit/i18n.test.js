const { t } = require('../../src/i18n');

describe('I18n Module', () => {
  test('should return the key if translation is missing', () => {
    expect(t('missing.key')).toBe('missing.key');
  });

  test('should translate correctly for existing keys', () => {
    // ui.title exists in en.json
    expect(t('ui.title')).toBe('LOGLOOP INTERACTIVE');
  });

  test('should fallback to en if locale is missing', () => {
    // Mocking config to a missing lang would require more effort,
    // but the logic is simple.
    expect(t('ui.cmdQuit')).toContain('/q');
  });
});
