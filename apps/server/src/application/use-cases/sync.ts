import {
  MAX_CHANGES_PER_REQUEST,
  MAX_ROWS_PER_RESPONSE,
  clampHlc,
  type Hlc,
  type ServerRow,
  type SyncRequest,
} from '@mes-courses/sync-core';

import { applyWithMerge } from './apply-with-merge';
import type { Clock } from '../ports/clock';
import type {
  ArticleRecord,
  CategoryRecord,
  ListItemRecord,
  ListRecord,
  Repositories,
  ServerStore,
} from '../ports/store';

export class TooManyChangesError extends Error {
  constructor() {
    super('TooManyChanges');
  }
}

export type SyncDeps = { store: ServerStore; clock: Clock };

export type SyncResult = {
  acknowledged: string[];
  rows: ServerRow[];
  seq: number;
  hlc: Hlc;
  more?: boolean;
};

const categoryRow = (r: CategoryRecord): ServerRow => ({
  kind: 'category',
  id: r.id,
  seq: r.seq,
  fields: {
    name: { value: r.name, hlc: r.nameHlc },
    position: { value: r.position, hlc: r.positionHlc },
  },
  createdHlc: r.createdHlc,
  deletedHlc: r.deletedHlc,
  mergedInto: r.mergedInto,
});

const articleRow = (r: ArticleRecord): ServerRow => ({
  kind: 'article',
  id: r.id,
  seq: r.seq,
  fields: {
    name: { value: r.name, hlc: r.nameHlc },
    categoryId: { value: r.categoryId, hlc: r.categoryHlc },
  },
  createdHlc: r.createdHlc,
  deletedHlc: r.deletedHlc,
  mergedInto: r.mergedInto,
});

const listRow = (r: ListRecord): ServerRow => ({
  kind: 'list',
  id: r.id,
  seq: r.seq,
  fields: { name: { value: r.name, hlc: r.nameHlc } },
  createdHlc: r.createdHlc,
  deletedHlc: r.deletedHlc,
  mergedInto: r.mergedInto,
});

const itemRow = (r: ListItemRecord): ServerRow => ({
  kind: 'listItem',
  id: `${r.listId}:${r.articleId}`,
  seq: r.seq,
  fields: {
    listId: { value: r.listId, hlc: r.presentHlc },
    articleId: { value: r.articleId, hlc: r.presentHlc },
    present: { value: r.present, hlc: r.presentHlc },
    inCart: { value: r.inCart, hlc: r.inCartHlc },
    quantity: { value: r.quantity, hlc: r.quantityHlc },
  },
  createdHlc: r.presentHlc,
  deletedHlc: null,
  mergedInto: null,
});

/** The rows after `lastSeq`, by increasing `seq`, ending on a whole `seq` (never splitting a change). */
const pull = async (
  repos: Repositories,
  lastSeq: number,
): Promise<{ rows: ServerRow[]; more: boolean }> => {
  const limit = MAX_ROWS_PER_RESPONSE;
  const all = [
    ...(await repos.categories.changedSince(lastSeq, limit + 1)).map(
      categoryRow,
    ),
    ...(await repos.articles.changedSince(lastSeq, limit + 1)).map(articleRow),
    ...(await repos.lists.changedSince(lastSeq, limit + 1)).map(listRow),
    ...(await repos.items.changedSince(lastSeq, limit + 1)).map(itemRow),
  ].sort((a, b) => a.seq - b.seq);

  if (all.length <= limit) return { rows: all, more: false };

  const cutSeq = all[limit - 1]?.seq ?? 0;
  if (all[limit]?.seq !== cutSeq)
    return { rows: all.slice(0, limit), more: true };
  const whole = all.filter((row) => row.seq < cutSeq);
  return {
    rows: whole.length > 0 ? whole : all.filter((row) => row.seq <= cutSeq),
    more: true,
  };
};

export const sync = async (
  { store, clock }: SyncDeps,
  deviceId: string,
  request: SyncRequest,
): Promise<SyncResult> => {
  if (request.changes.length > MAX_CHANGES_PER_REQUEST) {
    throw new TooManyChangesError();
  }
  const nowMs = clock.nowMs();
  const hlc = clampHlc(request.hlc, nowMs);

  return store.run(async (repos) => {
    const acknowledged: string[] = [];
    for (const incoming of request.changes) {
      if (!(await repos.appliedChanges.has(incoming.changeId))) {
        const change = { ...incoming, hlc: clampHlc(incoming.hlc, nowMs) };
        await applyWithMerge(repos, change, nowMs);
        await repos.appliedChanges.add({
          changeId: change.changeId,
          deviceId,
          appliedAt: new Date(nowMs).toISOString(),
        });
      }
      acknowledged.push(incoming.changeId);
    }

    const device = await repos.devices.get(deviceId);
    if (device) {
      await repos.devices.update({
        ...device,
        lastSyncAt: new Date(nowMs).toISOString(),
      });
    }

    const { rows, more } = await pull(repos, request.lastSeq);
    const last = rows[rows.length - 1];
    const seq = more && last ? last.seq : await repos.meta.currentSeq();
    return { acknowledged, rows, seq, hlc, ...(more && { more }) };
  });
};
