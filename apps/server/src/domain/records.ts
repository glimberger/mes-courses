import type { Hlc } from '@mes-courses/sync-core';

// The rows the domain builds and the store keeps (data-model.md, "Server database").

export type Stamped = {
  createdHlc: Hlc;
  /** A tombstone: a deleted article, or an entity merged into another. */
  deletedHlc: Hlc | null;
  /** The survivor's id when the entity was merged by name (research R8). */
  mergedInto: string | null;
  /** The change counter value of the last change that touched the row. */
  seq: number;
};

export type CategoryRecord = Stamped & {
  id: string;
  name: string;
  nameHlc: Hlc;
  normalizedName: string;
  position: number;
  positionHlc: Hlc;
};

export type ArticleRecord = Stamped & {
  id: string;
  name: string;
  nameHlc: Hlc;
  normalizedName: string;
  categoryId: string;
  categoryHlc: Hlc;
};

export type ListRecord = Stamped & {
  id: string;
  name: string;
  nameHlc: Hlc;
  normalizedName: string;
};

export type ListItemRecord = {
  listId: string;
  articleId: string;
  present: boolean;
  presentHlc: Hlc;
  inCart: boolean;
  inCartHlc: Hlc;
  quantity: { amount: number; unit: string | null } | null;
  quantityHlc: Hlc;
  seq: number;
};
