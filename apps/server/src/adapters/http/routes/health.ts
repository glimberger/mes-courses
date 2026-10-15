import type { FastifyInstance } from 'fastify';

import type { AppDeps } from '../deps';

export const registerHealthRoutes = (
  app: FastifyInstance,
  { release }: Pick<AppDeps, 'release'>,
): void => {
  // The server's identity is added to every response body; the release is for this route only.
  app.get('/v1/health', { config: { public: true } }, async () => ({
    release: { version: release.version, commit: release.commit },
  }));
};
