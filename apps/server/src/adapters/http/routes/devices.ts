import type { FastifyInstance, FastifyRequest } from 'fastify';

import { InvalidDeviceNameError } from '../../../application/use-cases/invalid-device-name';
import { listDevices } from '../../../application/use-cases/list-devices';
import { NotFoundError } from '../../../application/use-cases/not-found';
import { renameDevice } from '../../../application/use-cases/rename-device';
import { revokeDevice } from '../../../application/use-cases/revoke-device';
import type { AppDeps } from '../deps';
import { sendError } from '../errors';
import { renameDeviceBodySchema } from '../schemas';

export const registerDeviceRoutes = (
  app: FastifyInstance,
  deps: AppDeps,
): void => {
  const accountOf = (request: FastifyRequest): string => {
    const accountId = request.device?.accountId;
    if (accountId === undefined) throw new Error('Unauthenticated request');
    return accountId;
  };

  app.get('/v1/devices', async (request) => ({
    devices: await listDevices(deps, accountOf(request)),
  }));

  app.patch<{ Params: { id: string }; Body: { name: string } }>(
    '/v1/devices/:id',
    { schema: { body: renameDeviceBodySchema } },
    async (request, reply) => {
      try {
        return await renameDevice(
          deps,
          accountOf(request),
          request.params.id,
          request.body.name,
        );
      } catch (error) {
        if (error instanceof NotFoundError) return sendError(reply, 'NotFound');
        if (error instanceof InvalidDeviceNameError) {
          return sendError(reply, 'BadRequest');
        }
        throw error;
      }
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/v1/devices/:id',
    async (request, reply) => {
      try {
        await revokeDevice(deps, accountOf(request), request.params.id);
        return await reply.status(204).send();
      } catch (error) {
        if (error instanceof NotFoundError) return sendError(reply, 'NotFound');
        throw error;
      }
    },
  );
};
