import { API_VERSION, type ServerIdentity } from '@mes-courses/sync-core';
import Fastify, { type FastifyInstance } from 'fastify';

import { isBelow } from '../../domain/version';
import { authenticate } from './auth';
import type { AppDeps } from './deps';
import { sendError } from './errors';
import { registerHealthRoutes } from './routes/health';
import { registerPairingRoutes } from './routes/pairing';
import { registerSyncRoutes } from './routes/sync';

const BODY_LIMIT = 1024 * 1024;

export type { AppDeps } from './deps';

export const buildApp = (deps: AppDeps): FastifyInstance => {
  const app = Fastify({
    bodyLimit: BODY_LIMIT,
    logger: false,
    // Reject a wrong type or an unknown property instead of coercing or stripping it.
    ajv: { customOptions: { coerceTypes: false, removeAdditional: false } },
  });

  let serverId: string | undefined;
  const identity = async (): Promise<ServerIdentity> => {
    serverId ??= await deps.store.run(({ meta }) => meta.serverId());
    return {
      serverId,
      apiVersion: API_VERSION,
      minAppVersion: deps.minAppVersion,
    };
  };

  // Every JSON object body carries the server's identity (the app detects a reset server with it).
  app.addHook('onSend', async (_request, _reply, payload) => {
    if (typeof payload !== 'string' || !payload.startsWith('{')) return payload;
    try {
      return JSON.stringify({ ...JSON.parse(payload), ...(await identity()) });
    } catch (error) {
      // A failing lookup must not turn a clean error body into a broken response.
      deps.errorReporter.report(error, {
        operation: 'http',
        route: 'identity',
      });
      return payload;
    }
  });

  // Version first, then authorization: a refused request reads and changes nothing. A request
  // without the header is let through, so `curl` can check the server.
  app.addHook('onRequest', async (request, reply) => {
    const appVersion = request.headers['x-app-version'];
    if (
      typeof appVersion === 'string' &&
      isBelow(appVersion, deps.minAppVersion)
    ) {
      return sendError(reply, 'UpdateRequired');
    }
    if (request.routeOptions.config.public === true) return;
    const device = await authenticate(deps, request.headers.authorization);
    if (device === null) return sendError(reply, 'DeviceNotAuthorized');
    request.device = device;
  });

  app.setNotFoundHandler((_request, reply) => sendError(reply, 'NotFound'));

  app.setErrorHandler((error: { statusCode?: number }, request, reply) => {
    // Validation, malformed JSON and oversized bodies are the caller's fault.
    if (
      error.statusCode !== undefined &&
      error.statusCode >= 400 &&
      error.statusCode < 500
    ) {
      return sendError(reply, 'BadRequest');
    }
    deps.errorReporter.report(error, {
      operation: 'http',
      route: `${request.method} ${request.routeOptions.url ?? 'none'}`,
    });
    return sendError(reply, 'ServerError');
  });

  registerHealthRoutes(app);
  registerPairingRoutes(app, deps);
  registerSyncRoutes(app, deps);

  return app;
};
