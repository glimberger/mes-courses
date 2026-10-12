import type { IdGenerator } from '../ports/id-generator';
import type { LocalDataEraser } from '../ports/local-data-eraser';
import type { UnitOfWork } from '../ports/unit-of-work';
import { seedStore, type Seed } from '../use-cases/initialize-store';
import type { InMemoryRepositories } from './in-memory-repositories';

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
