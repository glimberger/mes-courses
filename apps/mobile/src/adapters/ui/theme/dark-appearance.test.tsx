import { StyleSheet } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { PaperProvider } from 'react-native-paper';
import { render, screen } from '@testing-library/react-native';

import materialTheme from '../../../../../../design/material-theme.json';
import { BrandCheckbox } from '../components/BrandCheckbox';
import { CategoryHeader } from '../components/CategoryHeader';
import { Card } from '../components/Card';
import { ScreenFab } from '../components/ScreenFab';
import { shadows } from './elevation';
import { darkTheme, lightTheme } from './theme';

/** The host views of a render that draw this color as their background. */
const drawnIn = (root: ReactTestInstance, color: string) =>
  root.findAll(
    (node) =>
      typeof node.type === 'string' &&
      StyleSheet.flatten(node.props.style)?.backgroundColor === color,
  );

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

describe('the current list blocks in dark appearance', () => {
  const renderIn = (element: React.ReactElement) =>
    render(<PaperProvider theme={darkTheme}>{element}</PaperProvider>);

  it('draws cards on surfaceContainerLowest with the dark card shadow', () => {
    renderIn(<Card testID="card">{null}</Card>);
    expect(screen.getByTestId('card')).toHaveStyle({
      backgroundColor: darkTheme.colors.surfaceContainerLowest,
      boxShadow: shadows(darkTheme).card,
    });
  });

  it('draws the category bar in the brand yellow of dark appearance', () => {
    renderIn(<CategoryHeader title="Crèmerie" />);
    expect(
      screen.getByTestId('category-bar', { includeHiddenElements: true }),
    ).toHaveStyle({
      backgroundColor: darkTheme.colors.primaryContainer,
    });
    expect(darkTheme.colors.primaryContainer).toBe('#FFDE3F');
  });

  it('fills a checked checkbox with the brand yellow', () => {
    renderIn(
      <BrandCheckbox checked accessibilityLabel="Lait" onPress={() => {}} />,
    );
    const box = screen.getByRole('checkbox', { name: 'Lait' });
    expect(
      drawnIn(box, darkTheme.colors.primaryContainer).length,
    ).toBeGreaterThan(0);
  });

  it('fills the screen fab with the brand yellow', () => {
    renderIn(
      <ScreenFab icon="add" label="Ajouter" onPress={() => {}} testID="fab" />,
    );
    expect(screen.getByTestId('fab')).toHaveStyle({
      backgroundColor: darkTheme.colors.primaryContainer,
    });
  });

  it('keeps the page surface of the mockups in dark appearance', () => {
    expect(darkTheme.colors.surface).toBe(materialTheme.schemes.dark.surface);
  });
});
