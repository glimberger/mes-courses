import type { Seed } from '../../application/use-cases/initialize-store';

/**
 * The use cases the store calls, one entry per use case of the driving ports, added story by
 * story (contracts/driving-ports.md).
 */
export type UseCases = {
  initializeStore: (seed: Seed) => Promise<void>;
};
