import type { FastifyInstance } from 'fastify';

import {
  claimPairingCode,
  InvalidCodeError,
  InvalidDeviceNameError,
  TooManyAttemptsError,
} from '../../../application/use-cases/claim-pairing-code';
import { createPairingCode } from '../../../application/use-cases/create-pairing-code';
import type { AppDeps } from '../deps';
import { sendError } from '../errors';
import { claimBodySchema, pairingCodesBodySchema } from '../schemas';

export const registerPairingRoutes = (
  app: FastifyInstance,
  deps: AppDeps,
): void => {
  app.post<{ Body: { code: string; deviceName: string } }>(
    '/v1/pairing/claim',
    { config: { public: true }, schema: { body: claimBodySchema } },
    async (request, reply) => {
      try {
        return await claimPairingCode(
          deps,
          request.body.code,
          request.body.deviceName,
        );
      } catch (error) {
        if (error instanceof TooManyAttemptsError) {
          return sendError(reply, 'TooManyAttempts', {
            'Retry-After': String(error.retryAfterSeconds),
          });
        }
        if (error instanceof InvalidCodeError) {
          return sendError(reply, 'InvalidCode');
        }
        if (error instanceof InvalidDeviceNameError) {
          return sendError(reply, 'BadRequest');
        }
        throw error;
      }
    },
  );

  app.post(
    '/v1/pairing-codes',
    { schema: { body: pairingCodesBodySchema } },
    async (request) => createPairingCode(deps, request.device?.id ?? null),
  );
};
