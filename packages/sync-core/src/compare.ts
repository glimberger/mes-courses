/** The one string order of the package: by UTF-16 code unit, identical on every device. */
export const compareStrings = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0;
