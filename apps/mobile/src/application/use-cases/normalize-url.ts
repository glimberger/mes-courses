/** `host`, `host:port` or an IPv4 address; letters, digits, dots and hyphens in the host. */
const HOST = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{1,5})?$/;

/**
 * The server address as stored: `https://` added when no scheme is typed, host in lower case,
 * trailing slashes dropped. `http://` is refused unless `allowInsecure` (development only,
 * FR-019). Returns `null` for anything else.
 */
export const normalizeUrl = (
  typed: string,
  allowInsecure: boolean,
): string | null => {
  const match = /^(?:([a-z][a-z0-9+.-]*):\/\/)?(.*)$/i.exec(typed.trim());
  const scheme = (match?.[1] ?? 'https').toLowerCase();
  if (scheme !== 'https' && !(scheme === 'http' && allowInsecure)) return null;
  const rest = (match?.[2] ?? '').replace(/\/+$/, '');
  const [authority = '', ...path] = rest.split('/');
  if (!HOST.test(authority.toLowerCase())) return null;
  return `${scheme}://${[authority.toLowerCase(), ...path].join('/')}`;
};
