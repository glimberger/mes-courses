import type { Article, ArticleId } from '../../domain/article';
import type { Category, CategoryId } from '../../domain/category';
import type { ListItem } from '../../domain/list-item';
import type { ListId, ShoppingList } from '../../domain/shopping-list';

export interface CategoryRepository {
  /** Ordered by position. */
  all(): Promise<Category[]>;
  findById(id: CategoryId): Promise<Category | null>;
  findByNormalizedName(normalizedName: string): Promise<Category | null>;
  /** The highest position plus one, 0 when there is no category. */
  nextPosition(): Promise<number>;
  add(category: Category): Promise<void>;
}

export interface ArticleRepository {
  /** In the order they were added. */
  all(): Promise<Article[]>;
  findById(id: ArticleId): Promise<Article | null>;
  findByNormalizedName(normalizedName: string): Promise<Article | null>;
  add(article: Article): Promise<void>;
}

export interface ShoppingListRepository {
  /** In the order they were added. */
  all(): Promise<ShoppingList[]>;
  findById(id: ListId): Promise<ShoppingList | null>;
  findByNormalizedName(normalizedName: string): Promise<ShoppingList | null>;
  count(): Promise<number>;
  add(list: ShoppingList): Promise<void>;
  /** The number of items of every list, 0 included. */
  itemCounts(): Promise<Map<ListId, number>>;
}

export interface ListItemRepository {
  /** In the order they were added; an update keeps the item's place. */
  forList(listId: ListId): Promise<ListItem[]>;
  find(listId: ListId, articleId: ArticleId): Promise<ListItem | null>;
  /** Inserts the item, or updates it when the list already holds the article. */
  save(item: ListItem): Promise<void>;
  remove(listId: ListId, articleId: ArticleId): Promise<void>;
  /** Unticks every item of the list, keeping the items and their quantities. */
  takeAllOutOfCart(listId: ListId): Promise<void>;
}

export interface AppStateRepository {
  /** `null` only before `initializeStore`. */
  currentListId(): Promise<ListId | null>;
  setCurrentListId(id: ListId): Promise<void>;
}
