import {
  compareHlc,
  mergeField,
  pickSurvivor,
  type Hlc,
} from '@mes-courses/sync-core';

import type { ListItemRecord, Stamped } from './records';

type Entity = { id: string } & Stamped;

/**
 * Of two live entities with the same normalized name, the one that is kept: the one created
 * first, ties broken by id (research R8). The rule does not depend on arrival order.
 */
export const mergeOrder = <T extends Entity>(
  a: T,
  b: T,
): { survivor: T; loser: T } => {
  const survivor = pickSurvivor(a, b);
  return { survivor, loser: survivor === a ? b : a };
};

/** The loser as a tombstone pointing at its survivor, on the `seq` of the change. */
export const tombstoneMerged = <T extends Entity>(
  loser: T,
  survivorId: string,
  hlc: Hlc,
  seq: number,
): T => ({ ...loser, deletedHlc: hlc, mergedInto: survivorId, seq });

/**
 * The stamp an entity is created with. The snapshot a joining device sends carries the minimum
 * stamp (research R13), which would make it older than anything the server holds and so win the
 * merge: it is dated from when the server learned of it instead, so what the server already
 * holds survives (FR-017, SC-007).
 */
export const createdAtJoin = (hlc: Hlc, serverNowMs: number): Hlc =>
  hlc.wallMs === 0 ? { ...hlc, wallMs: serverNowMs } : hlc;

const later = (a: Hlc, b: Hlc): Hlc => (compareHlc(a, b) >= 0 ? a : b);

/**
 * Moves the item of a merged article or list to its survivor. When the survivor is already on
 * the list, the two are merged field by field (research R5, R8). Returns the survivor's item to
 * save, and the loser's item as gone (`present = false`), each `null` when there is nothing to
 * write.
 */
export const mergeItems = (
  loser: ListItemRecord,
  existing: ListItemRecord | null,
  to: { listId: string; articleId: string },
  hlc: Hlc,
  seq: number,
): { survivor: ListItemRecord | null; loser: ListItemRecord | null } => {
  const gone = loser.present
    ? {
        ...loser,
        present: false,
        presentHlc: later(hlc, loser.presentHlc),
        seq,
      }
    : null;
  if (existing === null) {
    return {
      survivor: loser.present ? { ...loser, ...to, seq } : null,
      loser: gone,
    };
  }
  const present = mergeField(
    { value: existing.present, hlc: existing.presentHlc },
    { value: loser.present, hlc: loser.presentHlc },
  );
  const inCart = mergeField(
    { value: existing.inCart, hlc: existing.inCartHlc },
    { value: loser.inCart, hlc: loser.inCartHlc },
  );
  const quantity = mergeField(
    { value: existing.quantity, hlc: existing.quantityHlc },
    { value: loser.quantity, hlc: loser.quantityHlc },
  );
  return {
    survivor: {
      ...existing,
      present: present.value,
      presentHlc: present.hlc,
      inCart: inCart.value,
      inCartHlc: inCart.hlc,
      quantity: quantity.value,
      quantityHlc: quantity.hlc,
      seq,
    },
    loser: gone,
  };
};
