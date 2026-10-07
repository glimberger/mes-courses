import { parseQuantity } from '../../../domain/quantity';
import { formatQuantity } from './format-quantity';

describe('formatQuantity', () => {
  it.each([
    [{ amount: 1.5, unit: 'kg' }, '1,5 kg'],
    [{ amount: 6, unit: null }, '6'],
    [{ amount: 2, unit: 'L' }, '2 L'],
    [{ amount: 0.125, unit: 'kg' }, '0,125 kg'],
    [{ amount: 9999, unit: null }, '9999'],
  ])(
    'FR-017 shows %o as "%s", with a decimal comma and no digit grouping',
    (quantity, text) => {
      expect(formatQuantity(quantity)).toBe(text);
    },
  );

  it('FR-017 shows an amount that parses back to the same amount', () => {
    const text = formatQuantity({ amount: 1.5, unit: null });

    expect(parseQuantity(text, '')).toEqual({
      ok: true,
      value: { amount: 1.5, unit: null },
    });
  });
});
