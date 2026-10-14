/** Apps older than this are refused with 426 (research R12). */
export const MIN_APP_VERSION = '1.1.0';

export const DEFAULT_DATABASE_PATH = '/var/lib/mes-courses/mes-courses.db';
export const LISTEN_HOST = '127.0.0.1';
export const DEFAULT_PORT = 3000;

type Env = Record<string, string | undefined>;

export const databasePath = (env: Env): string =>
  env.MES_COURSES_DB || DEFAULT_DATABASE_PATH;

/** Unset or empty: the default. Set but not a port: an error, so a typo is not silently ignored. */
export const listenPort = (env: Env): number => {
  const raw = env.MES_COURSES_PORT;
  if (!raw) return DEFAULT_PORT;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`MES_COURSES_PORT is not a valid port: ${raw}`);
  }
  return port;
};

export type MailConfig =
  | { mode: 'smtp'; url: string; from: string }
  | { mode: 'console' }
  /** Production without an SMTP server: every send fails with `MailFailed` (research R8). */
  | { mode: 'unconfigured' };

/**
 * `MES_COURSES_SMTP_URL`, `MES_COURSES_MAIL_FROM`. An empty SMTP address selects the console
 * mailer outside production and a mailer that always fails in production. Errors name the
 * variable, never its value, which holds the provider's password.
 */
export const mailConfig = (env: Env): MailConfig => {
  const url = env.MES_COURSES_SMTP_URL;
  if (!url) {
    return env.NODE_ENV === 'production'
      ? { mode: 'unconfigured' }
      : { mode: 'console' };
  }
  const from = env.MES_COURSES_MAIL_FROM;
  if (!from) {
    throw new Error(
      'MES_COURSES_MAIL_FROM is required with MES_COURSES_SMTP_URL',
    );
  }
  return { mode: 'smtp', url, from };
};

/** The address written in the invitation: the public one, or the local one in development. */
export const publicUrl = (env: Env): string => {
  const configured = env.MES_COURSES_PUBLIC_URL;
  if (configured) return configured.replace(/\/+$/, '');
  if (env.NODE_ENV === 'production') {
    throw new Error('MES_COURSES_PUBLIC_URL is required in production');
  }
  return `http://${LISTEN_HOST}:${listenPort(env)}`;
};
