import type { ServerRow } from '@mes-courses/sync-core';

/** What a pull changed, kept in memory only (research R10a). */
export type RemoteEffects = {
  /** Articles tombstoned by this pull. */
  deletedArticles: string[];
  /** List items set to `present = false` by this pull. */
  removedItems: { listId: string; articleId: string }[];
  /** Entities merged into another by name. */
  merges: { kind: string; loserId: string; survivorId: string }[];
};

/** Applies pulled rows to the local tables, in the caller's transaction. */
export interface PulledRowsApplier {
  /**
   * `pendingFields` holds the fields with a local change still waiting, which a pulled value must
   * not overwrite. Also moves `app_state.current_list_id` to the survivor when the current list is
   * merged (research R8a).
   */
  apply(
    rows: ServerRow[],
    pendingFields: Set<string>,
  ): Promise<{ deferred: number; effects: RemoteEffects }>;
}
