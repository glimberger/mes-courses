import { darkTheme, lightTheme } from './theme';
import materialTheme from '../../../../../../design/material-theme.json';

describe('dark appearance keeps the brand identity', () => {
  it('keeps the brand yellow unchanged in both appearances', () => {
    expect(lightTheme.colors.primaryContainer).toBe('#FFDE3F');
    expect(darkTheme.colors.primaryContainer).toBe('#FFDE3F');
  });

  it('uses the dark surface family when dark', () => {
    expect(darkTheme.dark).toBe(true);
    expect(lightTheme.dark).toBe(false);
    expect(darkTheme.colors.background).toBe(
      materialTheme.schemes.dark.background,
    );
    expect(lightTheme.colors.background).toBe(
      materialTheme.schemes.light.background,
    );
  });

  it('keeps Nunito in both themes', () => {
    for (const variant of Object.values(darkTheme.fonts)) {
      expect(variant.fontFamily).toMatch(/^Nunito_/);
    }
  });
});
