const parse = (version: string): [number, number, number] | null => {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(version.trim());
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
};

/**
 * Whether `version` is below `minimum`, comparing `major.minor.patch` (a pre-release or build
 * suffix is ignored). A version that does not parse counts as below, so a broken client is asked
 * to update rather than served.
 */
export const isBelow = (version: string, minimum: string): boolean => {
  const a = parse(version);
  const b = parse(minimum);
  if (a === null) return true;
  if (b === null) return false;
  for (let i = 0; i < 3; i++) {
    const [x, y] = [a[i] ?? 0, b[i] ?? 0];
    if (x !== y) return x < y;
  }
  return false;
};
