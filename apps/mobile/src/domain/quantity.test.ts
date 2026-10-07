import { parseQuantity } from './quantity';

const quantity = (amount: number, unit: string | null = null) => ({
  ok: true,
  value: { amount, unit },
});

const refused = (type: string) => ({ ok: false, error: { type } });

describe('parseQuantity', () => {
  it.each([
    ['', ''],
    ['  ', ' \t'],
  ])(
    'FR-014 gives no quantity when both texts are blank ("%s", "%s")',
    (amount, unit) => {
      expect(parseQuantity(amount, unit)).toEqual({ ok: true, value: null });
    },
  );

  it.each([
    ['1,5', 1.5],
    ['1.5', 1.5],
    ['6', 6],
    ['0,125', 0.125],
    ['9999', 9999],
    ['007', 7],
    [' 2 ', 2],
  ])('FR-014 FR-017 reads the amount "%s" as %d', (text, amount) => {
    expect(parseQuantity(text, '')).toEqual(quantity(amount));
  });

  it('FR-022 cleans the unit like a name', () => {
    expect(parseQuantity('6', ' paquets  de 6 ')).toEqual(
      quantity(6, 'paquets de 6'),
    );
  });

  it('FR-022 gives no unit, and no error, for a unit empty after cleaning', () => {
    expect(parseQuantity('2', ' \u200B\u00A0')).toEqual(quantity(2));
  });

  it.each([
    'abc',
    '1 000',
    '+2',
    '1e3',
    '1,5,2',
    ',5',
    '1,',
    '1,,5',
    '1.5,2',
    '--1',
  ])('FR-016 refuses the amount "%s" with AmountNotANumber', (text) => {
    expect(parseQuantity(text, '')).toEqual(refused('AmountNotANumber'));
  });

  it.each(['0', '0,0', '0,000', '000', '-2', '-0,5'])(
    'US2-12 FR-016 refuses the amount "%s" with AmountNotPositive',
    (text) => {
      expect(parseQuantity(text, '')).toEqual(refused('AmountNotPositive'));
    },
  );

  it.each(['1,2345', '1,5000', '0,0001'])(
    'FR-016 refuses the amount "%s", with more than 3 digits after the separator as typed, with AmountTooPrecise',
    (text) => {
      expect(parseQuantity(text, '')).toEqual(refused('AmountTooPrecise'));
    },
  );

  it.each(['10000', '9999,5', '9999,001'])(
    'FR-016 refuses the amount "%s", above 9 999, with AmountTooLarge',
    (text) => {
      expect(parseQuantity(text, '')).toEqual(refused('AmountTooLarge'));
    },
  );

  it('US2-13 FR-016 refuses a unit with no amount with UnitWithoutAmount', () => {
    expect(parseQuantity('', 'kg')).toEqual(refused('UnitWithoutAmount'));
    expect(parseQuantity('  ', ' kg ')).toEqual(refused('UnitWithoutAmount'));
  });

  it('FR-022 accepts a unit of 15 characters after cleaning', () => {
    expect(parseQuantity('1', `  ${'u'.repeat(15)}  `)).toEqual(
      quantity(1, 'u'.repeat(15)),
    );
  });

  it('FR-022 refuses a unit of 16 characters with UnitTooLong', () => {
    expect(parseQuantity('1', 'u'.repeat(16))).toEqual(refused('UnitTooLong'));
  });

  it('FR-022 counts the unit in code points, so 15 emoji are accepted', () => {
    expect(parseQuantity('1', '🥚'.repeat(15))).toEqual(
      quantity(1, '🥚'.repeat(15)),
    );
  });

  describe('FR-016 returns the first error in the order of the rules', () => {
    it.each([
      ['-1,2345', '', 'AmountNotPositive'],
      ['-10000', '', 'AmountNotPositive'],
      ['10000,5555', '', 'AmountTooPrecise'],
      ['abc', 'u'.repeat(16), 'AmountNotANumber'],
      ['0', 'kg', 'AmountNotPositive'],
      ['10000', 'u'.repeat(16), 'AmountTooLarge'],
      ['', 'u'.repeat(16), 'UnitWithoutAmount'],
    ])('amount "%s" with unit "%s" gives %s', (amount, unit, type) => {
      expect(parseQuantity(amount, unit)).toEqual(refused(type));
    });
  });
});
