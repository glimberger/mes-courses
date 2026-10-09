import { compareHlc, type Hlc } from './hlc';

/** A synced field: its value and the stamp of the change that set it. */
export type FieldValue<T> = { value: T; hlc: Hlc };

/** A field changes only when the incoming stamp is greater (FR-009, FR-010). */
export const mergeField = <T>(
  current: FieldValue<T>,
  incoming: FieldValue<T>,
): FieldValue<T> =>
  compareHlc(incoming.hlc, current.hlc) > 0 ? incoming : current;

const compareStrings = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0;

type Created = { id: string; createdHlc: Hlc };

const compareCreated = (a: Created, b: Created): number =>
  compareHlc(a.createdHlc, b.createdHlc) || compareStrings(a.id, b.id);

/** Of two entities with the same normalized name, the one that is kept (R8). */
export const pickSurvivor = <T extends Created>(a: T, b: T): T =>
  compareCreated(a, b) <= 0 ? a : b;

/** Categories are ordered by `(position, createdHlc, id)` (FR-014). */
export const compareCategories = (
  a: Created & { position: number },
  b: Created & { position: number },
): number => a.position - b.position || compareCreated(a, b);
