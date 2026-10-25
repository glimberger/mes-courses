import { PaperProvider } from 'react-native-paper';
import { render, screen } from '@testing-library/react-native';

import { darkTheme, lightTheme, type AppTheme } from '../theme/theme';
import { Chip, type ChipProps } from './Chip';

const renderChip = (theme: AppTheme, props: ChipProps) => {
  render(
    <PaperProvider theme={theme}>
      <Chip testID="chip" {...props} />
    </PaperProvider>,
  );
  return {
    container: screen.getByTestId('chip'),
    label: screen.getByText(props.children),
  };
};

const TONES = [
  ['secondary', 'secondaryContainer', 'onSecondaryContainer'],
  ['tertiary', 'tertiaryContainer', 'onTertiaryContainer'],
  ['brand', 'primaryContainer', 'onPrimaryContainer'],
] as const;

describe.each([
  ['light', lightTheme],
  ['dark', darkTheme],
])('Chip in the %s appearance', (_name, theme) => {
  it.each(TONES)(
    'draws the %s tone on %s with %s text',
    (tone, background, foreground) => {
      const { container, label } = renderChip(theme, {
        tone,
        children: 'Étiquette',
      });

      expect(container).toHaveStyle({
        backgroundColor: theme.colors[background],
        borderRadius: 9999,
        paddingVertical: 5,
        paddingHorizontal: 12,
        gap: 5,
      });
      expect(label).toHaveStyle({ color: theme.colors[foreground] });
    },
  );

  it('sets its label in the labelMedium type role', () => {
    const { label } = renderChip(theme, {
      tone: 'brand',
      children: 'en cours',
    });
    expect(label).toHaveStyle({
      fontFamily: theme.fonts.labelMedium.fontFamily,
      fontSize: theme.fonts.labelMedium.fontSize,
    });
  });

  it('wraps a long label instead of truncating it', () => {
    const { label } = renderChip(theme, {
      tone: 'secondary',
      children: 'Un libellé très long qui doit passer à la ligne',
    });
    expect(label.props.numberOfLines).toBeUndefined();
  });

  it('draws its icon at 16 dp when one is given', () => {
    renderChip(theme, {
      tone: 'tertiary',
      icon: 'check',
      children: 'Déjà dans la liste',
    });
    expect(screen.UNSAFE_getByProps({ source: 'check' }).props.size).toBe(16);
  });
});
