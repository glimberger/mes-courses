export type CategoryId = string & { readonly __brand: 'CategoryId' };

/** A section of the shop; `position` sets the display order (FR-003). */
export type Category = {
  id: CategoryId;
  name: string;
  position: number;
};
