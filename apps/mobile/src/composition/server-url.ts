import { normalizeUrl } from '../application/use-cases/normalize-url';

/** The build did not provide a usable sync server address. */
export class ServerUrlNotConfigured extends Error {
  constructor() {
    super(
      'EXPO_PUBLIC_DEFAULT_SERVER_URL is missing or is not a valid address; set it when building the app',
    );
    this.name = 'ServerUrlNotConfigured';
  }
}

/** The sync server address baked into the build, validated; throws when absent or invalid. */
export const fixedServerUrl = (
  raw: string | undefined,
  allowInsecure: boolean,
): string => {
  const url = raw === undefined ? null : normalizeUrl(raw, allowInsecure);
  if (url === null) throw new ServerUrlNotConfigured();
  return url;
};
