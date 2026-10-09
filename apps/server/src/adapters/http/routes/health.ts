import type { FastifyInstance } from 'fastify';

export const registerHealthRoutes = (app: FastifyInstance): void => {
  // The server's identity is added to every response body.
  app.get('/v1/health', { config: { public: true } }, async () => ({}));
};
