import { AccessibilityInfo } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { lightTheme } from '../theme/theme';
import { ThemeProvider } from '../theme/theme-provider';
import { NameField } from './NameField';

const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');

beforeEach(() => announce.mockReset());
afterAll(() => announce.mockRestore());

const renderField = (error: string | null = null) => {
  const onChangeText = jest.fn();
  const rendered = render(
    <NameField value="Houmous" onChangeText={onChangeText} error={error} />,
    { wrapper: ThemeProvider },
  );
  return { ...rendered, onChangeText };
};

describe('NameField', () => {
  it('is labelled "Nom" and gives what is typed to onChangeText', () => {
    const { onChangeText } = renderField();

    fireEvent.changeText(screen.getByLabelText('Nom'), 'Houmous maison');

    expect(screen.getByLabelText('Nom')).toHaveDisplayValue('Houmous');
    expect(onChangeText).toHaveBeenCalledWith('Houmous maison');
  });

  it('R6 FR-022 sets no native maxLength, which would count UTF-16 units', () => {
    renderField();

    expect(screen.getByLabelText('Nom').props.maxLength).toBeUndefined();
  });

  it('FR-038 shows its error in a HelperText, announced as it appears', () => {
    const { rerender, onChangeText } = renderField();
    expect(announce).not.toHaveBeenCalled();

    rerender(
      <NameField
        value=""
        onChangeText={onChangeText}
        error="Indiquez un nom."
      />,
    );

    expect(screen.getByText('Indiquez un nom.')).toBeOnTheScreen();
    expect(announce).toHaveBeenCalledWith('Indiquez un nom.');
  });
});

describe('NameField typeface', () => {
  it('sets the typed text in the bodyLarge family, Nunito_600SemiBold', () => {
    renderField();
    expect(screen.getByLabelText('Nom')).toHaveStyle({
      fontFamily: 'Nunito_600SemiBold',
    });
  });
});

describe('NameField outline', () => {
  // Paper's outlined input gets the outline props it is given, on the outermost element.
  const outlineOf = () =>
    screen
      .UNSAFE_getAllByProps({ label: 'Nom' })
      .map((node) => node.props)
      .filter((props) => 'outlineStyle' in props)[0];

  it('draws a 1.5 dp outline in the outline role on a screen, with 16 dp corners', () => {
    renderField();
    expect(outlineOf()).toMatchObject({
      outlineStyle: { borderRadius: 16, borderWidth: 1.5 },
    });
    expect(outlineOf()).toMatchObject({
      outlineColor: lightTheme.colors.outline,
    });
  });

  it('draws the dialog outline with 14 dp corners in a dialog', () => {
    render(
      <NameField
        value=""
        onChangeText={jest.fn()}
        error={null}
        context="dialog"
      />,
      { wrapper: ThemeProvider },
    );
    expect(outlineOf()).toMatchObject({
      outlineStyle: { borderRadius: 14, borderWidth: 1.5 },
    });
  });
});
