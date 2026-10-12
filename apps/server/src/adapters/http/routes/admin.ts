import type { FastifyInstance } from 'fastify';

import { inviteAccount } from '../../../application/use-cases/invite-account';
import { listAccounts } from '../../../application/use-cases/list-accounts';
import type { AppDeps } from '../deps';
import { sendError } from '../errors';
import { inviteBodySchema } from '../schemas';

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
};
