export type ListId = string & { readonly __brand: 'ListId' };

export type ShoppingList = {
  id: ListId;
  name: string;
};
