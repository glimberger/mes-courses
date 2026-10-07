export type ListId = string & { readonly __brand: 'ListId' };

export type ShoppingList = {
  id: ListId;
  name: string;
};

/** No list has this id (a missing record, never the user's input). */
export type ListNotFound = { type: 'ListNotFound' };
