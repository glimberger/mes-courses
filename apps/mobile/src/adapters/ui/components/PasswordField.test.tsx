import { fireEvent, render, screen } from '@testing-library/react-native';

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
