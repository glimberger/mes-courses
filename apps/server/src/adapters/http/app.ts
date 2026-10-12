import { API_VERSION, type ServerIdentity } from '@mes-courses/sync-core';
import Fastify, { type FastifyInstance } from 'fastify';

import { isBelow } from '../../domain/version';
import { authenticate } from './auth';
import type { AppDeps } from './deps';
import { sendError } from './errors';
import { registerAccountRoutes } from './routes/account';
import { registerAdminRoutes } from './routes/admin';
import { registerAuthRoutes } from './routes/auth';
import { registerDeviceRoutes } from './routes/devices';
import { registerHealthRoutes } from './routes/health';
import { registerSyncRoutes } from './routes/sync';

const BODY_LIMIT = 1024 * 1024;

export type { AppDeps } from './deps';

export const buildApp = (deps: AppDeps): FastifyInstance => {
  const app = Fastify({
    bodyLimit: BODY_LIMIT,
    logger: false,
    // Only Caddy, on this machine, may name the client address (`X-Forwarded-For`); from anyone
    // else the header is ignored, so the sign-in limits cannot be dodged by forging it.
    trustProxy: '127.0.0.1',
    // Reject a wrong type or an unknown property instead of coercing or stripping it. String
    // lengths count UTF-16 units, as the contract says of the password fields.
    ajv: {
      customOptions: {
        coerceTypes: false,
        removeAdditional: false,
        unicode: false,
      },
    },
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
  app.addHook('onSend', async (request, _reply, payload) => {
    if (typeof payload !== 'string' || !payload.startsWith('{')) return payload;
    try {
      // `accountId` for an authenticated caller (004 research R9); a sign-in body carries its own.
      const accountId = request.device?.accountId;
      return JSON.stringify({
        ...(accountId === undefined ? {} : { accountId }),
        ...JSON.parse(payload),
        ...(await identity()),
      });
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
    const result = await authenticate(deps, request.headers.authorization);
    if (result.kind === 'notAuthorized') {
      return sendError(reply, 'DeviceNotAuthorized');
    }
    if (result.kind === 'accountDeleted') {
      return sendError(reply, 'AccountDeleted');
    }
    if (result.kind === 'suspended') {
      return sendError(reply, 'AccountSuspended');
    }
    // The role is the server's to decide, before the route reads anything (US1-5).
    if (
      request.routeOptions.config.administrator === true &&
      result.account.role !== 'administrator'
    ) {
      return sendError(reply, 'Forbidden');
    }
    request.device = result.device;
    request.account = result.account;
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
  registerAccountRoutes(app);
  registerAdminRoutes(app, deps);
  registerAuthRoutes(app, deps);
  registerDeviceRoutes(app, deps);
  registerSyncRoutes(app, deps);

  return app;
};
