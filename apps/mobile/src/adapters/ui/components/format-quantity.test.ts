import { parseQuantity, type Quantity } from '../../../domain/quantity';
import { formatQuantity } from './format-quantity';

const examples: [Quantity, string][] = [
  [{ amount: 1.5, unit: 'kg' }, '1,5 kg'],
  [{ amount: 6, unit: null }, '6'],
  [{ amount: 2, unit: 'L' }, '2 L'],
  [{ amount: 0.125, unit: 'kg' }, '0,125 kg'],
  [{ amount: 9999, unit: null }, '9999'],
];

describe('formatQuantity', () => {
  it.each(examples)(
    'FR-017 shows %o as "%s", with a decimal comma and no digit grouping',
    (quantity, text) => {
      expect(formatQuantity(quantity)).toBe(text);
    },
  );

  // The QuantityDialog prefills the amount field with the formatted amount and the unit field
  // with the unit, so both must parse back to the same quantity.
  it.each(examples)(
    'FR-017 shows the amount of %o so that it parses back unchanged',
    (quantity) => {
      const amountText = formatQuantity({ ...quantity, unit: null });

      expect(parseQuantity(amountText, quantity.unit ?? '')).toEqual({
        ok: true,
        value: quantity,
      });
    },
  );
});
