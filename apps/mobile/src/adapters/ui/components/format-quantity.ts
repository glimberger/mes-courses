import type { Quantity } from '../../../domain/quantity';

// No digit grouping and no trailing zeros, so the QuantityDialog prefill parses back unchanged.
const amountFormat = new Intl.NumberFormat('fr-FR', {
  maximumFractionDigits: 3,
  useGrouping: false,
});

/** A quantity in French, for example "1,5 kg" (FR-017). */
export const formatQuantity = ({ amount, unit }: Quantity): string => {
  const formatted = amountFormat.format(amount);
  return unit === null ? formatted : `${formatted} ${unit}`;
};
