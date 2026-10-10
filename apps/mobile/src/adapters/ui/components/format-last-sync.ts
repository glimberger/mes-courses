const pad = (n: number) => String(n).padStart(2, '0');
const time = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * When the device last synchronized, in words: "Jamais", "à l'instant", "il y a 25 min",
 * "aujourd'hui à 09:05", "hier à 22:45", then the date (US4-8). Written by hand, so it does not
 * depend on the `Intl` support of the JS engine.
 */
export const formatLastSync = (iso: string | null, now: Date): string => {
  if (iso === null) return 'Jamais';
  const at = new Date(iso);
  const elapsed = now.getTime() - at.getTime();
  if (elapsed >= 0 && elapsed < 60_000) return "à l'instant";
  if (elapsed >= 0 && elapsed < 60 * 60_000) {
    return `il y a ${Math.floor(elapsed / 60_000)} min`;
  }
  // Rounded: a day lasts 23 or 25 hours when the clocks change.
  const days = Math.round((startOfDay(now) - startOfDay(at)) / DAY_MS);
  if (days === 0) return `aujourd'hui à ${time(at)}`;
  if (days === 1) return `hier à ${time(at)}`;
  return `le ${pad(at.getDate())}/${pad(at.getMonth() + 1)}/${at.getFullYear()} à ${time(at)}`;
};
