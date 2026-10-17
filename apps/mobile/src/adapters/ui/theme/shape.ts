/**
 * Shape (radius) tokens. The Material scale sits on the 4 dp grid; the mockup radii that fall
 * outside it (checkbox, field, FAB, bar) are named here too. Paper's `roundness` stays at 4
 * (research R3).
 */
export const shape = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 28,
  pill: 9999,
  checkbox: 7,
  field: 14,
  fab: 18,
  bar: 2,
} as const;
