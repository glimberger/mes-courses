import type { FastifyInstance } from 'fastify';

import { getAccount } from '../../../application/use-cases/get-account';

export const registerAccountRoutes = (app: FastifyInstance): void => {
  app.get('/v1/account', async (request) => {
    if (request.account === undefined)
      throw new Error('Unauthenticated request');
    return { account: getAccount(request.account) };
  });
};
