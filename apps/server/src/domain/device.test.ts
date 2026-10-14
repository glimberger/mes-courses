import { cleanDeviceName } from './device';

describe('cleanDeviceName', () => {
  it('004 FR-008 trims the name and accepts 1 to 60 characters', () => {
    expect(cleanDeviceName('  Pixel 8 ')).toBe('Pixel 8');
    expect(cleanDeviceName('a')).toBe('a');
    expect(cleanDeviceName('a'.repeat(60))).toBe('a'.repeat(60));
  });

  it('004 FR-008 refuses an empty or too long name', () => {
    expect(cleanDeviceName('   ')).toBeNull();
    expect(cleanDeviceName('a'.repeat(61))).toBeNull();
  });
});
