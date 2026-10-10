import { useEffect, useRef } from 'react';

import type { ArticleId } from '../../../domain/article';
import type { ListId } from '../../../domain/shopping-list';
import { useAppStoreApi } from './app-store-provider';
import { followRedirects } from './store-kit';

/** What a form edits: an article (EditArticle) or an item of a list (QuantityDialog). */
export type RemovalTarget = { articleId: ArticleId; listId?: ListId };

export type RemovalReason = 'articleDeleted' | 'itemRemoved';

/**
 * Calls `onRemoved` when a cycle that ends after the form mounted deleted its article or removed
 * its item from its list (FR-020a, research R10a). Cycles before the mount are ignored.
 */
export const useRemoteRemoval = (
  target: RemovalTarget,
  onRemoved: (reason: RemovalReason) => void,
): void => {
  const store = useAppStoreApi();
  const latest = useRef({ target, onRemoved });
  // After each render, so a cycle always sees the target and the callback last rendered.
  useEffect(() => {
    latest.current = { target, onRemoved };
  });

  useEffect(
    () =>
      store.subscribe((state, previous) => {
        if (state.sync.remote === previous.sync.remote) return;
        const { effects } = state.sync.remote;
        const { target: now, onRemoved: callback } = latest.current;
        // The form may hold an id merged away since: the deletion names its survivor.
        const followed = followRedirects(state.sync.redirects, now.articleId);
        if (
          effects.deletedArticles.includes(now.articleId) ||
          effects.deletedArticles.includes(followed)
        ) {
          callback('articleDeleted');
        } else if (
          now.listId !== undefined &&
          effects.removedItems.some(
            (item) =>
              item.listId === now.listId &&
              (item.articleId === now.articleId || item.articleId === followed),
          )
        ) {
          callback('itemRemoved');
        }
      }),
    [store],
  );
};
