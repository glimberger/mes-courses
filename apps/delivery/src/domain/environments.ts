import type { Environment } from './manifest';

/** What the agent knows about an environment (data-model "Environment"). Nothing else is configurable. */
export type EnvironmentSettings = {
  /** The port Caddy proxies to. */
  port: number;
  /** The port a new version listens on until it is healthy, unreachable by the phones (FR-019a). */
  validationPort: number;
};

export const ENVIRONMENT_SETTINGS: Record<Environment, EnvironmentSettings> = {
  production: { port: 3000, validationPort: 3100 },
  staging: { port: 3001, validationPort: 3101 },
};

/** Staging first: a release never waits behind a staging deployment's failure, but never overtakes it. */
export const ENVIRONMENTS_IN_ORDER: Environment[] = ['staging', 'production'];
