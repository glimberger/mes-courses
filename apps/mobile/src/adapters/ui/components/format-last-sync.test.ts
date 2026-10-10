import { formatLastSync } from './format-last-sync';

const now = new Date(2026, 9, 6, 14, 30);
const at = (
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
) => new Date(year, month, day, hours, minutes).toISOString();

describe('formatLastSync', () => {
  it('says "Jamais" when the device never synchronized', () => {
    expect(formatLastSync(null, now)).toBe('Jamais');
  });

  it('says "à l\'instant" within the last minute', () => {
    expect(
      formatLastSync(new Date(now.getTime() - 20_000).toISOString(), now),
    ).toBe("à l'instant");
    expect(formatLastSync(at(2026, 9, 6, 14, 29), now)).toBe('il y a 1 min');
  });

  it('counts minutes within the hour', () => {
    expect(formatLastSync(at(2026, 9, 6, 14, 5), now)).toBe('il y a 25 min');
  });

  it('gives the time for earlier today', () => {
    expect(formatLastSync(at(2026, 9, 6, 9, 5), now)).toBe(
      "aujourd'hui à 09:05",
    );
  });

  it('gives "hier" and the time for yesterday', () => {
    expect(formatLastSync(at(2026, 9, 5, 22, 45), now)).toBe('hier à 22:45');
  });

  it('gives the date and the time before that', () => {
    expect(formatLastSync(at(2026, 8, 28, 8, 0), now)).toBe(
      'le 28/09/2026 à 08:00',
    );
  });

  it('gives the date for a time in the future (a clock set back)', () => {
    expect(formatLastSync(at(2026, 9, 7, 10, 0), now)).toBe(
      'le 07/10/2026 à 10:00',
    );
  });
});
