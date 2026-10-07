import { useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import type { QuantityError } from '../../../domain/quantity';
import { ThemeProvider } from '../theme/theme-provider';
import { QuantityFields } from './QuantityFields';

const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');

beforeEach(() => announce.mockReset());
afterAll(() => announce.mockRestore());

/** The fields as a form holds them, with the error the test gives. */
const Form = ({ error }: { error: QuantityError | null }) => {
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState('');
  return (
    <QuantityFields
      amount={amount}
      unit={unit}
      onChangeAmount={setAmount}
      onChangeUnit={setUnit}
      error={error}
    />
  );
};

const renderFields = (error: QuantityError | null = null) =>
  render(<Form error={error} />, { wrapper: ThemeProvider });

describe('QuantityFields', () => {
  it('labels its fields "Quantité" and "Unité", and shows what is typed', () => {
    renderFields();

    fireEvent.changeText(screen.getByLabelText('Quantité'), '1,5');
    fireEvent.changeText(screen.getByLabelText('Unité'), 'kg');

    expect(screen.getByLabelText('Quantité')).toHaveDisplayValue('1,5');
    expect(screen.getByLabelText('Unité')).toHaveDisplayValue('kg');
  });

  it('FR-017 asks for a decimal number in the amount field', () => {
    renderFields();

    expect(screen.getByLabelText('Quantité').props.inputMode).toBe('decimal');
  });

  it('shows no error when there is none', () => {
    renderFields();

    expect(screen.queryByText(/quantité|unité/)).not.toBeOnTheScreen();
    expect(announce).not.toHaveBeenCalled();
  });

  it.each([
    [
      'AmountNotANumber',
      'La quantité doit être un nombre positif écrit en chiffres, par exemple 2 ou 1,5.',
    ],
    [
      'AmountNotPositive',
      'La quantité doit être un nombre positif écrit en chiffres, par exemple 2 ou 1,5.',
    ],
    ['AmountTooPrecise', 'La quantité ne peut pas avoir plus de 3 décimales.'],
    ['AmountTooLarge', 'La quantité ne peut pas dépasser 9999.'],
    ['UnitWithoutAmount', 'Indiquez une quantité pour cette unité.'],
    ['UnitTooLong', "L'unité ne peut pas dépasser 15 caractères."],
  ] as [QuantityError['type'], string][])(
    'FR-016 FR-038 shows %s as "%s", announced as it appears',
    (type, text) => {
      const { rerender } = renderFields();

      rerender(<Form error={{ type }} />);

      expect(screen.getByText(text)).toBeOnTheScreen();
      expect(announce).toHaveBeenCalledTimes(1);
      expect(announce).toHaveBeenCalledWith(text);
    },
  );
});
