import { MAX_AMOUNT_DECIMALS, type Quantity } from '../../../domain/quantity';

// No digit grouping and no trailing zeros, so the QuantityDialog prefill parses back unchanged.
const amountFormat = new Intl.NumberFormat('fr-FR', {
  maximumFractionDigits: MAX_AMOUNT_DECIMALS,
  useGrouping: false,
});

/** An amount in French, for example "1,5": typed back, it reads as the same amount (FR-017). */
export const formatAmount = (amount: number): string =>
  amountFormat.format(amount);

/** A quantity in French, for example "1,5 kg" (FR-017). */
export const formatQuantity = ({ amount, unit }: Quantity): string => {
  const formatted = formatAmount(amount);
  return unit === null ? formatted : `${formatted} ${unit}`;
};
