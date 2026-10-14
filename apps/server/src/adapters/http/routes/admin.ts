import type { FastifyInstance } from 'fastify';

import { deleteAccount } from '../../../application/use-cases/delete-account';
import { inviteAccount } from '../../../application/use-cases/invite-account';
import { listAccounts } from '../../../application/use-cases/list-accounts';
import { reactivateAccount } from '../../../application/use-cases/reactivate-account';
import { resendCredentials } from '../../../application/use-cases/resend-credentials';
import { suspendAccount } from '../../../application/use-cases/suspend-account';
import type { AppDeps } from '../deps';
import { sendError } from '../errors';
import { accountIdParamsSchema, inviteBodySchema } from '../schemas';

/** Every route here is for administrators only: the hook answers `403 Forbidden` before any read. */
export const registerAdminRoutes = (
  app: FastifyInstance,
  deps: AppDeps,
): void => {
  const config = { administrator: true } as const;

  app.get('/v1/admin/accounts', { config }, async () => ({
    accounts: await listAccounts(deps),
  }));

  app.post<{ Body: { email: string } }>(
    '/v1/admin/accounts',
    { config, schema: { body: inviteBodySchema } },
    async (request, reply) => {
      const outcome = await inviteAccount(deps, request.body.email);
      switch (outcome.kind) {
        case 'invited':
          return reply.status(201).send({ account: outcome.account });
        case 'invalidEmail':
          return sendError(reply, 'InvalidEmail');
        case 'exists':
          return sendError(reply, 'AccountExists');
        case 'mailFailed':
          return sendError(reply, 'MailFailed');
      }
    },
  );

  const params = { params: accountIdParamsSchema };

  app.post<{ Params: { id: string } }>(
    '/v1/admin/accounts/:id/suspend',
    { config, schema: params },
    async (request, reply) => {
      const outcome = await suspendAccount(deps, request.params.id);
      if (outcome.kind === 'notFound') return sendError(reply, 'NotFound');
      if (outcome.kind === 'lastAdministrator') {
        return sendError(reply, 'LastAdministrator');
      }
      return reply.status(204).send();
    },
  );

  app.post<{ Params: { id: string } }>(
    '/v1/admin/accounts/:id/reactivate',
    { config, schema: params },
    async (request, reply) => {
      const outcome = await reactivateAccount(deps, request.params.id);
      if (outcome.kind === 'notFound') return sendError(reply, 'NotFound');
      return reply.status(204).send();
    },
  );

  app.post<{ Params: { id: string } }>(
    '/v1/admin/accounts/:id/resend-credentials',
    { config, schema: params },
    async (request, reply) => {
      const outcome = await resendCredentials(deps, request.params.id);
      switch (outcome.kind) {
        case 'sent':
          return reply.status(204).send();
        case 'notFound':
          return sendError(reply, 'NotFound');
        case 'notInvited':
          return sendError(reply, 'NotInvited');
        case 'mailFailed':
          return sendError(reply, 'MailFailed');
      }
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/v1/admin/accounts/:id',
    { config, schema: params },
    async (request, reply) => {
      const outcome = await deleteAccount(deps, request.params.id);
      if (outcome.kind === 'notFound') return sendError(reply, 'NotFound');
      if (outcome.kind === 'lastAdministrator') {
        return sendError(reply, 'LastAdministrator');
      }
      return reply.status(204).send();
    },
  );
};
