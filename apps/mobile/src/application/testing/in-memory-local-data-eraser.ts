import type { IdGenerator } from '../ports/id-generator';
import type { LocalDataEraser } from '../ports/local-data-eraser';
import type { UnitOfWork } from '../ports/unit-of-work';
import { seedStore, type Seed } from '../use-cases/initialize-store';
import type {
  InMemoryRepositories,
  InMemoryUnitOfWork,
} from './in-memory-repositories';

/** The eraser on the in-memory repositories: the unit of work restores them if the seed fails. */
export const inMemoryLocalDataEraser = ({
  repositories,
  unitOfWork,
  ids,
  seed,
}: {
  repositories: InMemoryRepositories;
  unitOfWork: UnitOfWork;
  ids: IdGenerator;
  seed: Seed;
}): LocalDataEraser => ({
  erase: () =>
    unitOfWork.run(async (repos) => {
      repositories.clear();
      await seedStore(repos, ids, seed);
    }),
});

/** The eraser of an in-memory unit of work, for the tests and stories that build the use cases. */
export const eraserOf = (
  unitOfWork: InMemoryUnitOfWork,
  ids: IdGenerator,
  seed: Seed,
): LocalDataEraser =>
  inMemoryLocalDataEraser({
    repositories: unitOfWork.repositories,
    unitOfWork,
    ids,
    seed,
  });
