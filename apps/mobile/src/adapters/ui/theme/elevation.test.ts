import { darkTheme, lightTheme } from './theme';
import { shadows } from './elevation';

// The shadow colors written out as RGB (design/material-theme.json): light shadow #1E1B13,
// dark shadow #000000, onPrimaryContainer #3A3000, scrim #141108. The expected strings are
// computed by hand, not by the code under test.
const LIGHT_SHADOW = '30, 27, 19';
const DARK_SHADOW = '0, 0, 0';
const ON_PRIMARY_CONTAINER = '58, 48, 0';
const SCRIM = '20, 17, 8';

const layer = (
  rgb: string,
  alpha: number,
  x: number,
  y: number,
  blur: number,
) => `${x}px ${y}px ${blur}px rgba(${rgb}, ${alpha})`;

describe('shadows', () => {
  it('builds the light card shadow from the shadow role', () => {
    expect(shadows(lightTheme).card).toBe(
      [
        layer(LIGHT_SHADOW, 0.05, 0, 1, 2),
        layer(LIGHT_SHADOW, 0.06, 0, 6, 16),
      ].join(', '),
    );
  });

  it('builds the dark card shadow from the same role, with stronger layers', () => {
    expect(shadows(darkTheme).card).toBe(
      [
        layer(DARK_SHADOW, 0.35, 0, 1, 2),
        layer(DARK_SHADOW, 0.3, 0, 6, 16),
      ].join(', '),
    );
  });

  it('builds the FAB shadow from onPrimaryContainer in both appearances', () => {
    const expected = [
      layer(ON_PRIMARY_CONTAINER, 0.2, 0, 4, 12),
      layer(ON_PRIMARY_CONTAINER, 0.14, 0, 1, 3),
    ].join(', ');
    expect(shadows(lightTheme).fab).toBe(expected);
    expect(shadows(darkTheme).fab).toBe(expected);
  });

  it('builds the dialog shadow from the shadow role', () => {
    expect(shadows(lightTheme).dialog).toBe(
      [
        layer(LIGHT_SHADOW, 0.24, 0, 14, 36),
        layer(LIGHT_SHADOW, 0.12, 0, 2, 6),
      ].join(', '),
    );
  });

  it('builds the snackbar shadow from the scrim role', () => {
    expect(shadows(lightTheme).snackbar).toBe(
      [layer(SCRIM, 0.26, 0, 6, 18), layer(SCRIM, 0.16, 0, 1, 3)].join(', '),
    );
  });

  it('builds the brand tile shadow from onPrimaryContainer', () => {
    expect(shadows(lightTheme).brandTile).toBe(
      layer(ON_PRIMARY_CONTAINER, 0.14, 0, 10, 28),
    );
  });
});
