import { cleanName, nameLength } from './name';
import { err, ok, type Result } from './result';

/** How much of an article to buy, on one list item only (FR-013). */
export type Quantity = { amount: number; unit: string | null };

export const MAX_AMOUNT = 9999;
export const MAX_AMOUNT_DECIMALS = 3;
export const MAX_UNIT_LENGTH = 15;

export type AmountNotANumber = { type: 'AmountNotANumber' };
export type AmountNotPositive = { type: 'AmountNotPositive' };
export type AmountTooPrecise = { type: 'AmountTooPrecise' };
export type AmountTooLarge = { type: 'AmountTooLarge' };
export type UnitWithoutAmount = { type: 'UnitWithoutAmount' };
export type UnitTooLong = { type: 'UnitTooLong' };
export type QuantityError =
  | AmountNotANumber
  | AmountNotPositive
  | AmountTooPrecise
  | AmountTooLarge
  | UnitWithoutAmount
  | UnitTooLong;

// Digits, with at most one decimal comma or point that has digits on both sides.
const AMOUNT_FORMAT = /^-?\d+(?:[.,](\d+))?$/u;

/**
 * Reads the amount and unit typed by the user: no quantity when both are blank, a quantity, or
 * the first broken rule, in the order of the data model (FR-014, FR-016, FR-022).
 */
export const parseQuantity = (
  amountText: string,
  unitText: string,
): Result<Quantity | null, QuantityError> => {
  const typedAmount = amountText.trim();
  const unit = cleanName(unitText) || null;

  if (typedAmount === '') {
    return unit === null ? ok(null) : err({ type: 'UnitWithoutAmount' });
  }

  const match = AMOUNT_FORMAT.exec(typedAmount);
  if (match === null) return err({ type: 'AmountNotANumber' });

  const amount = Number(typedAmount.replace(',', '.'));
  if (typedAmount.startsWith('-') || amount === 0)
    return err({ type: 'AmountNotPositive' });

  const decimals = match[1] ?? '';
  if (decimals.length > MAX_AMOUNT_DECIMALS)
    return err({ type: 'AmountTooPrecise' });
  if (amount > MAX_AMOUNT) return err({ type: 'AmountTooLarge' });

  if (unit !== null && nameLength(unit) > MAX_UNIT_LENGTH)
    return err({ type: 'UnitTooLong' });

  return ok({ amount, unit });
};
