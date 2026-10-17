import { shape } from './shape';

describe('shape tokens', () => {
  it('exports the Material 3 shape scale and the mockup radii', () => {
    expect(shape).toEqual({
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
    });
  });

  it('stays on the 4 dp grid where applicable', () => {
    for (const key of ['xs', 'sm', 'md', 'lg', 'xl'] as const) {
      expect(shape[key] % 4).toBe(0);
    }
  });
});
