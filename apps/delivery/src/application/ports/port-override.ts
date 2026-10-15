import type { Environment } from '../../domain/manifest';

/** `/run/mes-courses/<env>.env`: makes the service listen on the validation port. */
export interface PortOverride {
  useValidationPort(environment: Environment): Promise<void>;
  usePublicPort(environment: Environment): Promise<void>;
}
