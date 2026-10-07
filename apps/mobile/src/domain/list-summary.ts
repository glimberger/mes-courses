import type { ListId } from './shopping-list';

/** One row of the lists screen (US3-8). */
export type ListSummary = {
  id: ListId;
  name: string;
  /** Every item, ticked or not. */
  itemCount: number;
  isCurrent: boolean;
};
