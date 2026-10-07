import type {
  Repositories,
  UnitOfWork,
} from '../../application/ports/unit-of-work';
import { sqliteAppStateRepository } from './app-state-repository';
import { sqliteArticleRepository } from './article-repository';
import { sqliteCategoryRepository } from './category-repository';
import { sqliteListItemRepository } from './list-item-repository';
import { sqliteShoppingListRepository } from './shopping-list-repository';
import type { SqlDatabase } from './sql-database';
import { toStorageError } from './storage-error';

/** Every repository, on the given database. */
export const sqliteRepositories = (db: SqlDatabase): Repositories => ({
  categories: sqliteCategoryRepository(db),
  articles: sqliteArticleRepository(db),
  lists: sqliteShoppingListRepository(db),
  items: sqliteListItemRepository(db),
  appState: sqliteAppStateRepository(db),
});

/**
 * Runs the work in one SQLite transaction (FR-028). A SQLite transaction does not nest, so a run
 * started while another is still going rejects at once, as with the in-memory fake.
 */
export class SqliteUnitOfWork implements UnitOfWork {
  private running = false;
  private readonly repositories: Repositories;

  constructor(private readonly db: SqlDatabase) {
    this.repositories = sqliteRepositories(db);
  }

  async run<T>(work: (repos: Repositories) => Promise<T>): Promise<T> {
    if (this.running) {
      throw new Error('A run started while another is still running');
    }
    this.running = true;
    const outcome: { value?: T; failure?: { error: unknown } } = {};
    try {
      await this.db.withTransactionAsync(async () => {
        try {
          outcome.value = await work(this.repositories);
        } catch (error) {
          outcome.failure = { error };
          throw error;
        }
      });
      return outcome.value as T;
    } catch (error) {
      // The work's own error passes unchanged; the database's goes through `toStorageError`.
      if (outcome.failure && outcome.failure.error === error) throw error;
      throw toStorageError(error);
    } finally {
      this.running = false;
    }
  }
}
