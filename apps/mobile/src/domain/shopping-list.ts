import { compareNames } from './name';

export type ListId = string & { readonly __brand: 'ListId' };

export type ShoppingList = {
  id: ListId;
  name: string;
};

/** No list has this id (a missing record, never the user's input). */
export type ListNotFound = { type: 'ListNotFound' };

/** The list that becomes current when the current one goes: the first in displayed order. */
export const pickCurrentList = (
  lists: readonly ShoppingList[],
): ShoppingList | null =>
  lists.reduce<ShoppingList | null>(
    (first, list) =>
      first === null || compareNames(list.name, first.name) < 0 ? list : first,
    null,
  );
