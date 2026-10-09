/** Apps older than this are refused with 426 (research R12). */
export const MIN_APP_VERSION = '1.0.0';

export const DEFAULT_DATABASE_PATH = '/var/lib/mes-courses/mes-courses.db';
export const LISTEN_HOST = '127.0.0.1';
export const DEFAULT_PORT = 3000;

type Env = Record<string, string | undefined>;

export const databasePath = (env: Env): string =>
  env.MES_COURSES_DB || DEFAULT_DATABASE_PATH;

export const listenPort = (env: Env): number => {
  const port = Number(env.MES_COURSES_PORT);
  return Number.isInteger(port) &&
    port >= 0 &&
    port <= 65535 &&
    env.MES_COURSES_PORT
    ? port
    : DEFAULT_PORT;
};
