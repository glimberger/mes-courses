import {
  ERROR_CODES,
  type ErrorBody,
  type ErrorCode,
} from '@mes-courses/sync-core';
import type { FastifyReply } from 'fastify';

export const sendError = (
  reply: FastifyReply,
  code: ErrorCode,
  headers: Record<string, string> = {},
): FastifyReply => {
  const body: ErrorBody = { error: code };
  return reply.status(ERROR_CODES[code]).headers(headers).send(body);
};
