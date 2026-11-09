import { PaperProvider } from 'react-native-paper';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ok } from '../../../domain/result';
import { lightTheme } from '../theme/theme';
import { CreateNamedDialog } from './CreateNamedDialog';

jest.mock('../accessibility/focus', () => ({ focusOn: jest.fn() }));

const renderDialog = (
  props: Partial<Parameters<typeof CreateNamedDialog<string>>[0]> = {},
) => {
  const create = jest.fn(async (name: string) => ok(name));
  render(
    <PaperProvider theme={lightTheme}>
      <CreateNamedDialog<string>
        title="Nouvelle liste"
        alreadyUsedText="Déjà pris."
        create={create}
        onClose={jest.fn()}
        {...props}
      />
    </PaperProvider>,
  );
  return create;
};

describe('CreateNamedDialog', () => {
  it('starts empty and confirms with "Créer" by default', () => {
    renderDialog();

    expect(screen.getByLabelText('Nom')).toHaveDisplayValue('');
    expect(screen.getByRole('button', { name: 'Créer' })).toBeOnTheScreen();
  });

  it('pre-fills the field with initialName and labels the confirm button with confirmLabel', () => {
    renderDialog({ initialName: 'Barbecue', confirmLabel: 'Enregistrer' });

    expect(screen.getByLabelText('Nom')).toHaveDisplayValue('Barbecue');
    expect(
      screen.getByRole('button', { name: 'Enregistrer' }),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Créer' })).toBeNull();
  });

  it('validates a pre-filled name as before: a cleared field is refused without saving', () => {
    const create = renderDialog({
      initialName: 'Barbecue',
      confirmLabel: 'Enregistrer',
    });

    fireEvent.changeText(screen.getByLabelText('Nom'), '  ');
    fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(create).not.toHaveBeenCalled();
  });

  it('saves the pre-filled name as typed', () => {
    const create = renderDialog({
      initialName: 'Barbecue',
      confirmLabel: 'Enregistrer',
    });

    fireEvent.changeText(screen.getByLabelText('Nom'), 'Barbecue dimanche');
    fireEvent.press(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(create).toHaveBeenCalledWith('Barbecue dimanche');
  });
});
