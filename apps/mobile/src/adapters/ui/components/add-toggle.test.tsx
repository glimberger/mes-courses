import { render, screen } from '@testing-library/react-native';

import { lightTheme } from '../theme/theme';
import { ThemeProvider } from '../theme/theme-provider';
import { AddToggle, addToggleLabel } from './AddToggle';

const renderToggle = (added: boolean) =>
  render(
    <ThemeProvider>
      <AddToggle added={added} testID="toggle" />
    </ThemeProvider>,
  );

describe('AddToggle', () => {
  it('AC5 shows the outline add_circle in primary before the article is added', () => {
    renderToggle(false);

    const icon = screen.UNSAFE_getByProps({ name: 'add_circle' });
    expect(icon.props.color).toBe(lightTheme.colors.primary);
    expect(screen.UNSAFE_queryByProps({ name: 'check_circle' })).toBeNull();
  });

  it('AC5 shows the filled check_circle once the article is added', () => {
    renderToggle(true);

    const icon = screen.UNSAFE_getByProps({ name: 'check_circle' });
    expect(icon.props.color).toBe(lightTheme.colors.onTertiaryContainer);
    expect(screen.UNSAFE_queryByProps({ name: 'add_circle' })).toBeNull();
  });

  it('is round, and decorative: its row carries the label', () => {
    renderToggle(false);

    const toggle = screen.getByTestId('toggle', {
      includeHiddenElements: true,
    });
    expect(toggle).toHaveStyle({ width: 36, height: 36, borderRadius: 18 });
    expect(toggle.props.accessibilityElementsHidden).toBe(true);
  });

  it('AC5 words the label "Ajouter <name>", then "<name> ajoutée, toucher pour retirer"', () => {
    expect(addToggleLabel('Carotte', false)).toBe('Ajouter Carotte');
    expect(addToggleLabel('Carotte', true)).toBe(
      'Carotte ajoutée, toucher pour retirer',
    );
  });
});
