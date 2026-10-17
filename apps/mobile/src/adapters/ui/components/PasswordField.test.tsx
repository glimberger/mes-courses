import { fireEvent, render, screen } from '@testing-library/react-native';

import { lightTheme } from '../theme/theme';
import { ThemeProvider } from '../theme/theme-provider';
import { PasswordField } from './PasswordField';

const renderField = (
  props: Partial<Parameters<typeof PasswordField>[0]> = {},
) =>
  render(
    <PasswordField
      label="Mot de passe"
      value="secret"
      onChangeText={() => undefined}
      {...props}
    />,
    { wrapper: ThemeProvider },
  );

describe('PasswordField', () => {
  it('hides the text and shows it when asked, then hides it again', () => {
    renderField();
    expect(screen.getByLabelText('Mot de passe').props.secureTextEntry).toBe(
      true,
    );

    fireEvent.press(screen.getByLabelText('Afficher le mot de passe'));
    expect(screen.getByLabelText('Mot de passe').props.secureTextEntry).toBe(
      false,
    );

    fireEvent.press(screen.getByLabelText('Masquer le mot de passe'));
    expect(screen.getByLabelText('Mot de passe').props.secureTextEntry).toBe(
      true,
    );
  });

  it('shows its error under the field', () => {
    renderField({ error: 'Trop court.' });

    expect(screen.getByText('Trop court.')).toBeOnTheScreen();
  });

  it('passes what is typed on', () => {
    const onChangeText = jest.fn();
    renderField({ onChangeText });

    fireEvent.changeText(screen.getByLabelText('Mot de passe'), 'autre');

    expect(onChangeText).toHaveBeenCalledWith('autre');
  });
});

describe('PasswordField in the mockup look', () => {
  const outlineOf = () =>
    screen
      .UNSAFE_getAllByProps({ label: 'Mot de passe' })
      .map((node) => node.props)
      .filter((props) => 'outlineStyle' in props)[0];

  it('draws a 1.5 dp outline with 16 dp corners on a screen', () => {
    renderField();
    expect(outlineOf()).toMatchObject({
      outlineStyle: { borderRadius: 16, borderWidth: 1.5 },
    });
    expect(outlineOf()).toMatchObject({
      outlineColor: lightTheme.colors.outline,
    });
  });

  it('draws the outline with 14 dp corners in a dialog', () => {
    renderField({ context: 'dialog' });
    expect(outlineOf()).toMatchObject({
      outlineStyle: { borderRadius: 14, borderWidth: 1.5 },
    });
  });

  it('draws the eye toggle in onSurfaceVariant', () => {
    renderField();
    expect(screen.UNSAFE_getByProps({ source: 'visibility' }).props.color).toBe(
      lightTheme.colors.onSurfaceVariant,
    );
  });
});
