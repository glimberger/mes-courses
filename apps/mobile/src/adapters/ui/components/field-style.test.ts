import { darkTheme, lightTheme } from '../theme/theme';
import { fieldStyle } from './field-style';

describe.each([
  ['light', lightTheme],
  ['dark', darkTheme],
])('fieldStyle in the %s appearance', (_name, theme) => {
  it('gives screen fields a 16 dp outline radius', () => {
    expect(fieldStyle('screen', theme).outlineStyle).toEqual({
      borderRadius: 16,
      borderWidth: 1.5,
    });
  });

  it('gives dialog fields a 14 dp outline radius', () => {
    expect(fieldStyle('dialog', theme).outlineStyle).toEqual({
      borderRadius: 14,
      borderWidth: 1.5,
    });
  });

  it('keeps the label in the top border while the field is empty', () => {
    expect(fieldStyle('screen', theme).labelFloated).toBe(true);
  });

  it('fills a dialog field with the dialog surface and a screen field with the background', () => {
    expect(fieldStyle('dialog', theme).theme.colors.background).toBe(
      theme.colors.surfaceContainerLowest,
    );
    expect(fieldStyle('screen', theme).theme.colors.background).toBe(
      theme.colors.background,
    );
  });

  it('outlines in the outline role and types the text in onSurface', () => {
    const style = fieldStyle('screen', theme);
    expect(style.outlineColor).toBe(theme.colors.outline);
    expect(style.textColor).toBe(theme.colors.onSurface);
  });

  it('draws labels and trailing icons in onSurfaceVariant', () => {
    const style = fieldStyle('dialog', theme);
    expect(style.theme.colors.onSurfaceVariant).toBe(
      theme.colors.onSurfaceVariant,
    );
  });

  it('sets the typed text and placeholder in the bodyLarge family', () => {
    expect(fieldStyle('screen', theme).style.fontFamily).toBe(
      'Nunito_600SemiBold',
    );
  });
});
