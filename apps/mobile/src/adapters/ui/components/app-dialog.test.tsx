import { ScrollView, StyleSheet } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import {
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native';

import { shadows } from '../theme/elevation';
import { darkTheme, lightTheme, type AppTheme } from '../theme/theme';
import { AppDialog, type AppDialogProps } from './AppDialog';

const baseProps: AppDialogProps = {
  visible: true,
  title: 'Supprimer « Lait » ?',
  onDismiss: jest.fn(),
  message: 'Il est dans la liste « Ma liste ».',
  cancel: { label: 'Annuler', onPress: jest.fn() },
  confirm: { label: 'Supprimer', onPress: jest.fn(), mode: 'dangerFilled' },
};

/** The host view Paper draws the dialog surface on: the one with the dialog shadow. */
const surfaceOf = () =>
  screen
    .getByTestId('dialog-surface')
    .findAll(
      (node) =>
        typeof node.type === 'string' &&
        StyleSheet.flatten(node.props.style)?.boxShadow !== undefined,
    )[0];

const renderDialog = (theme: AppTheme, props: Partial<AppDialogProps> = {}) => {
  render(
    <PaperProvider theme={theme}>
      <AppDialog testID="dialog" {...baseProps} {...props} />
    </PaperProvider>,
  );
};

describe.each([
  ['light', lightTheme],
  ['dark', darkTheme],
])('AppDialog in the %s appearance', (_name, theme: AppTheme) => {
  it('sits on surfaceContainerLowest with 28 dp corners and the dialog shadow', () => {
    renderDialog(theme);
    const surface = surfaceOf();
    expect(surface).toHaveStyle({
      backgroundColor: theme.colors.surfaceContainerLowest,
      borderRadius: 28,
      boxShadow: shadows(theme).dialog,
    });
  });

  it('pads its content 26 dp at the top, 24 dp at the sides and 18 dp at the bottom', () => {
    renderDialog(theme);
    const content = StyleSheet.flatten(
      screen.getByTestId('dialog-content').props.style,
    );
    expect(content).toMatchObject({
      paddingTop: 26,
      paddingHorizontal: 24,
      paddingBottom: 18,
      gap: 14,
    });
  });

  it('is at most 90 % of the screen high, so a long content scrolls', () => {
    renderDialog(theme);
    expect(surfaceOf()).toHaveStyle({
      maxHeight: '90%',
    });
  });

  it('is a dialog whose title is a header, the target of the focus move', () => {
    renderDialog(theme);
    expect(
      screen.getByRole('header', { name: 'Supprimer « Lait » ?' }),
    ).toBeOnTheScreen();
  });

  it('sets the title in titleLarge and the message in bodyMedium, muted', () => {
    renderDialog(theme);
    expect(screen.getByText('Supprimer « Lait » ?')).toHaveStyle({
      fontFamily: theme.fonts.titleLarge.fontFamily,
    });
    expect(screen.getByText('Il est dans la liste « Ma liste ».')).toHaveStyle({
      fontFamily: theme.fonts.bodyMedium.fontFamily,
      color: theme.colors.onSurfaceVariant,
    });
  });

  it('draws a 56 dp brand icon circle above the title when an icon is given', () => {
    renderDialog(theme, { icon: 'shopping_cart_checkout' });
    expect(
      screen.UNSAFE_getByProps({ source: 'shopping_cart_checkout' }).props
        .color,
    ).toBe(theme.colors.onBrandSoft);
  });

  it('draws the error icon circle in the error tone', () => {
    renderDialog(theme, { icon: 'delete', iconTone: 'error' });
    expect(screen.UNSAFE_getByProps({ source: 'delete' }).props.color).toBe(
      theme.colors.onErrorContainer,
    );
  });

  it('places the actions at the end, the cancel text button before the confirm button', () => {
    renderDialog(theme);
    const actions = screen.getByTestId('dialog-actions');
    expect(StyleSheet.flatten(actions.props.style)).toMatchObject({
      justifyContent: 'flex-end',
      gap: 8,
    });
    const labels = within(actions)
      .getAllByRole('button')
      .map((button) => within(button).getByText(/.+/).props.children);
    expect(labels).toEqual(['Annuler', 'Supprimer']);
  });

  it('draws the confirm button in dangerFilled: error fill, onError text', () => {
    renderDialog(theme);
    expect(screen.getByRole('button', { name: 'Supprimer' })).toHaveStyle({
      backgroundColor: theme.colors.error,
    });
  });

  it('centers the title and the message in the centered layout', () => {
    renderDialog(theme, { layout: 'centered' });
    expect(screen.getByText('Supprimer « Lait » ?')).toHaveStyle({
      textAlign: 'center',
    });
    expect(screen.getByText('Il est dans la liste « Ma liste ».')).toHaveStyle({
      textAlign: 'center',
    });
  });

  it('shows an optional start action left-aligned, before the actions', () => {
    const onPress = jest.fn();
    renderDialog(theme, {
      startAction: { label: 'Effacer la quantité', onPress },
    });
    fireEvent.press(
      screen.getByRole('button', { name: 'Effacer la quantité' }),
    );
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('dialog-start-action')).toBeOnTheScreen();
  });

  it('puts the content in a scroll view, so it scrolls when it is taller than the dialog', () => {
    renderDialog(theme);
    expect(screen.UNSAFE_getByType(ScrollView)).toBeTruthy();
  });

  it('calls onDismiss when the overlay is tapped while the dialog is dismissable', () => {
    const onDismiss = jest.fn();
    renderDialog(theme, { onDismiss });
    fireEvent.press(screen.getByLabelText('Fermer la boîte de dialogue'));
    expect(onDismiss).toHaveBeenCalled();
  });
});
