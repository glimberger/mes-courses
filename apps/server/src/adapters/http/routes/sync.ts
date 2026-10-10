import type { SyncRequest } from '@mes-courses/sync-core';
import type { FastifyInstance } from 'fastify';

import { sync, TooManyChangesError } from '../../../application/use-cases/sync';
import type { AppDeps } from '../deps';
import { sendError } from '../errors';
import { syncBodySchema } from '../schemas';

export const registerSyncRoutes = (
  app: FastifyInstance,
  deps: AppDeps,
): void => {
  app.post<{ Body: SyncRequest }>(
    '/v1/sync',
    { schema: { body: syncBodySchema } },
    async (request, reply) => {
      const deviceId = request.device?.id;
      if (deviceId === undefined)
        return sendError(reply, 'DeviceNotAuthorized');
      try {
        return await sync(deps, deviceId, request.body);
      } catch (error) {
        if (error instanceof TooManyChangesError) {
          return sendError(reply, 'BadRequest');
        }
        throw error;
      }
    },
  );
};
