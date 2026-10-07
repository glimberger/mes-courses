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

/** Wraps every method so that it rejects once `isOpen` returns false. */
const guarded = <R extends object>(repository: R, isOpen: () => boolean): R =>
  Object.fromEntries(
    Object.entries(repository).map(([name, method]) => [
      name,
      (...args: unknown[]) =>
        isOpen()
          ? (method as (...args: unknown[]) => Promise<unknown>)(...args)
          : Promise.reject(
              new Error(`Repositories used after their run ended (${name})`),
            ),
    ]),
  ) as R;

/**
 * Runs the work in one SQLite transaction (FR-028). expo-sqlite's transaction does not keep
 * other statements out, so runs go one at a time, in the order they were started; a run started
 * inside another's work would wait for ever: use cases never nest runs. The repositories given
 * to the work reject once the run has ended, so no write escapes its transaction.
 */
export class SqliteUnitOfWork implements UnitOfWork {
  private queue: Promise<unknown> = Promise.resolve();
  private readonly repositories: Repositories;

  constructor(private readonly db: SqlDatabase) {
    this.repositories = sqliteRepositories(db);
  }

  run<T>(work: (repos: Repositories) => Promise<T>): Promise<T> {
    const result = this.queue.then(() => this.runNow(work));
    this.queue = result.catch(() => undefined);
    return result;
  }

  private async runNow<T>(
    work: (repos: Repositories) => Promise<T>,
  ): Promise<T> {
    let open = true;
    const isOpen = () => open;
    const repos = this.repositories;
    const outcome: { value?: T; failure?: { error: unknown } } = {};
    try {
      await this.db.withTransactionAsync(async () => {
        try {
          outcome.value = await work({
            categories: guarded(repos.categories, isOpen),
            articles: guarded(repos.articles, isOpen),
            lists: guarded(repos.lists, isOpen),
            items: guarded(repos.items, isOpen),
            appState: guarded(repos.appState, isOpen),
          });
        } catch (error) {
          outcome.failure = { error };
          throw error;
        }
      });
      return outcome.value as T;
    } catch (error) {
      // The work's own error is rethrown unchanged, even when the rollback after it fails too: it is
      // the cause. A failure of the database alone goes through `toStorageError`.
      if (outcome.failure) throw outcome.failure.error;
      throw toStorageError(error);
    } finally {
      open = false;
    }
  }
}
