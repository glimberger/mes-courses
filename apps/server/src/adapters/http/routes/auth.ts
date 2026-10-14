import type { FastifyInstance, FastifyReply } from 'fastify';

import { choosePassword } from '../../../application/use-cases/choose-password';
import { MailFailedError } from '../../../application/ports/mailer';
import { requestPasswordReset } from '../../../application/use-cases/request-password-reset';
import { signIn, type SignedIn } from '../../../application/use-cases/sign-in';
import type { AppDeps } from '../deps';
import { sendError } from '../errors';
import {
  choosePasswordBodySchema,
  passwordResetBodySchema,
  signInBodySchema,
} from '../schemas';

type Failure =
  | { kind: 'invalidEmail' }
  | { kind: 'invalidDeviceName' }
  | { kind: 'invalidPassword'; problem: string }
  | { kind: 'invalid' }
  | { kind: 'expired' }
  | { kind: 'suspended' }
  | { kind: 'blocked'; retryAfterSeconds: number };

/** The answer for each way a request fails; identical wherever the contract says so. */
const sendFailure = (reply: FastifyReply, failure: Failure): FastifyReply => {
  switch (failure.kind) {
    case 'invalidEmail':
      return sendError(reply, 'InvalidEmail');
    case 'invalidDeviceName':
      return sendError(reply, 'InvalidDeviceName');
    case 'invalidPassword':
      return sendError(
        reply,
        'InvalidPassword',
        {},
        { problem: failure.problem },
      );
    case 'invalid':
      return sendError(reply, 'InvalidCredentials');
    case 'expired':
      return sendError(reply, 'TemporaryPasswordExpired');
    case 'suspended':
      return sendError(reply, 'AccountSuspended');
    case 'blocked':
      return sendError(reply, 'TooManyAttempts', {
        'Retry-After': String(failure.retryAfterSeconds),
      });
  }
};

const signedInBody = ({ deviceId, credential, account }: SignedIn) => ({
  outcome: 'signedIn' as const,
  deviceId,
  credential,
  account,
  accountId: account.id,
});

/** The routes a device uses before it has a credential: public, rate limited (research R6). */
export const registerAuthRoutes = (
  app: FastifyInstance,
  deps: AppDeps,
): void => {
  const config = { public: true } as const;

  app.post<{ Body: { email: string; password: string; deviceName: string } }>(
    '/v1/auth/sign-in',
    { config, schema: { body: signInBodySchema } },
    async (request, reply) => {
      const outcome = await signIn(deps, {
        ...request.body,
        clientAddress: request.ip,
      });
      if (outcome.kind === 'signedIn') return signedInBody(outcome);
      if (outcome.kind === 'passwordChangeRequired') {
        return { outcome: 'passwordChangeRequired' };
      }
      return sendFailure(reply, outcome);
    },
  );

  app.post<{
    Body: {
      email: string;
      temporaryPassword: string;
      newPassword: string;
      deviceName: string;
    };
  }>(
    '/v1/auth/choose-password',
    { config, schema: { body: choosePasswordBodySchema } },
    async (request, reply) => {
      const outcome = await choosePassword(deps, {
        ...request.body,
        clientAddress: request.ip,
      });
      if (outcome.kind === 'signedIn') return signedInBody(outcome);
      return sendFailure(reply, outcome);
    },
  );

  app.post<{ Body: { email: string } }>(
    '/v1/auth/password-reset',
    { config, schema: { body: passwordResetBodySchema } },
    async (request, reply) => {
      const outcome = await requestPasswordReset(deps, {
        email: request.body.email,
        clientAddress: request.ip,
      });
      if (outcome.kind === 'invalidEmail') {
        return sendError(reply, 'InvalidEmail');
      }
      if (outcome.kind === 'blocked') return sendFailure(reply, outcome);

      const { message } = outcome;
      if (message !== null) {
        // Sent after the answer and never awaited by it: the response time must not reveal
        // whether the account exists, and a failure cannot change the answer (research R4).
        void deps.mailer.send(message).catch((error: unknown) => {
          // Only the fixed error of the mail adapter: no address (FR-020).
          deps.errorReporter.report(
            error instanceof MailFailedError ? error : new MailFailedError(),
            {
              operation: 'requestPasswordReset',
              route: 'POST /v1/auth/password-reset',
            },
          );
        });
      }
      return reply.status(202).send({});
    },
  );
};
