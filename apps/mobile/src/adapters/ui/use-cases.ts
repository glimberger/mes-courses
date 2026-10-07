import type { IdGenerator } from '../../application/ports/id-generator';
import type { UnitOfWork } from '../../application/ports/unit-of-work';
import {
  createInitializeStore,
  type Seed,
} from '../../application/use-cases/initialize-store';

/**
 * The use cases the store calls, one entry per use case of the driving ports, added story by
 * story (contracts/driving-ports.md).
 */
export type UseCases = {
  initializeStore: (seed: Seed) => Promise<void>;
};

/** The name of one use case. */
export type UseCaseName = keyof UseCases;

/**
 * Builds every use case on the given ports: the composition root gives it the SQLite adapters,
 * the stories and screen tests the in-memory fakes.
 */
export const createUseCases = (ports: {
  unitOfWork: UnitOfWork;
  ids: IdGenerator;
}): UseCases => ({
  initializeStore: createInitializeStore(ports),
});
