import type { FastifyInstance, FastifyReply } from 'fastify';

import {
  changePassword,
  type PasswordCheckFailure,
} from '../../../application/use-cases/change-password';
import { deleteOwnAccount } from '../../../application/use-cases/delete-own-account';
import { getAccount } from '../../../application/use-cases/get-account';
import type { AppDeps } from '../deps';
import { sendError } from '../errors';
import { changePasswordBodySchema, deleteAccountBodySchema } from '../schemas';

const sendCheckFailure = (
  reply: FastifyReply,
  failure: PasswordCheckFailure,
): FastifyReply =>
  failure.kind === 'blocked'
    ? sendError(reply, 'TooManyAttempts', {
        'Retry-After': String(failure.retryAfterSeconds),
      })
    : sendError(reply, 'InvalidCredentials');

export const registerAccountRoutes = (
  app: FastifyInstance,
  deps: AppDeps,
): void => {
  app.get('/v1/account', async (request) => {
    if (request.account === undefined)
      throw new Error('Unauthenticated request');
    return { account: getAccount(request.account) };
  });

  app.post<{ Body: { currentPassword: string; newPassword: string } }>(
    '/v1/account/password',
    { schema: { body: changePasswordBodySchema } },
    async (request, reply) => {
      if (request.account === undefined)
        throw new Error('Unauthenticated request');
      const outcome = await changePassword(deps, {
        ...request.body,
        accountId: request.account.id,
        clientAddress: request.ip,
      });
      switch (outcome.kind) {
        case 'changed':
          return reply.status(204).send();
        case 'invalidPassword':
          return sendError(
            reply,
            'InvalidPassword',
            {},
            { problem: outcome.problem },
          );
        default:
          return sendCheckFailure(reply, outcome);
      }
    },
  );

  app.delete<{ Body: { password: string } }>(
    '/v1/account',
    { schema: { body: deleteAccountBodySchema } },
    async (request, reply) => {
      if (request.account === undefined)
        throw new Error('Unauthenticated request');
      const outcome = await deleteOwnAccount(deps, {
        password: request.body.password,
        accountId: request.account.id,
        clientAddress: request.ip,
      });
      switch (outcome.kind) {
        case 'deleted':
          return reply.status(204).send();
        case 'lastAdministrator':
          return sendError(reply, 'LastAdministrator');
        default:
          return sendCheckFailure(reply, outcome);
      }
    },
  );
};
