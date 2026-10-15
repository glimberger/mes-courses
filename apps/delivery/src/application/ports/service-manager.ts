import type { Environment } from '../../domain/manifest';

export interface ServiceManager {
  start(environment: Environment): Promise<void>;
  stop(environment: Environment): Promise<void>;
  restart(environment: Environment): Promise<void>;
  isActive(environment: Environment): Promise<boolean>;
}
