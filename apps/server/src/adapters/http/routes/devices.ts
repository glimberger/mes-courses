import type { FastifyInstance } from 'fastify';

import { InvalidDeviceNameError } from '../../../application/use-cases/claim-pairing-code';
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
  app.get('/v1/devices', async () => ({ devices: await listDevices(deps) }));

  app.patch<{ Params: { id: string }; Body: { name: string } }>(
    '/v1/devices/:id',
    { schema: { body: renameDeviceBodySchema } },
    async (request, reply) => {
      try {
        return await renameDevice(deps, request.params.id, request.body.name);
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
        await revokeDevice(deps, request.params.id);
        return await reply.status(204).send();
      } catch (error) {
        if (error instanceof NotFoundError) return sendError(reply, 'NotFound');
        throw error;
      }
    },
  );
};
