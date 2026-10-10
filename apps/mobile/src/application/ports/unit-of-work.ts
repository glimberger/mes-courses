import type {
  AppStateRepository,
  ArticleRepository,
  CategoryRepository,
  ListItemRepository,
  ShoppingListRepository,
} from './repositories';
import type { ChangeRecorder } from './change-recorder';
import type { PulledRowsApplier } from './pulled-rows';
import type { SyncStateRepository } from './sync-state';

export interface Repositories {
  categories: CategoryRepository;
  articles: ArticleRepository;
  lists: ShoppingListRepository;
  items: ListItemRepository;
  appState: AppStateRepository;
  changes: ChangeRecorder;
  syncState: SyncStateRepository;
  pulledRows: PulledRowsApplier;
}

export interface UnitOfWork {
  /**
   * Runs the work in one transaction: every write is committed before the promise resolves, and
   * none is kept when the work throws (FR-028).
   */
  run<T>(work: (repos: Repositories) => Promise<T>): Promise<T>;
}
