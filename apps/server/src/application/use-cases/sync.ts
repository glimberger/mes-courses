import {
  MAX_CHANGES_PER_REQUEST,
  MAX_ROWS_PER_RESPONSE,
  clampHlc,
  compareHlc,
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

/** The highest HLC among `start` and the stamps of `rows`: what the device must catch up with. */
const highestHlc = (start: Hlc, rows: ServerRow[]): Hlc => {
  let highest = start;
  for (const row of rows) {
    const stamps = [
      row.createdHlc,
      row.deletedHlc,
      ...Object.values(row.fields).map((field) => field.hlc),
    ];
    for (const stamp of stamps) {
      if (stamp !== null && compareHlc(stamp, highest) > 0) highest = stamp;
    }
  }
  return highest;
};

const readSince = async (
  repos: Repositories,
  lastSeq: number,
  limit: number,
): Promise<ServerRow[]> =>
  [
    ...(await repos.categories.changedSince(lastSeq, limit)).map(categoryRow),
    ...(await repos.articles.changedSince(lastSeq, limit)).map(articleRow),
    ...(await repos.lists.changedSince(lastSeq, limit)).map(listRow),
    ...(await repos.items.changedSince(lastSeq, limit)).map(itemRow),
  ].sort((a, b) => a.seq - b.seq);

/** The rows after `lastSeq`, by increasing `seq`, ending on a whole `seq` (never splitting a change). */
const pull = async (
  repos: Repositories,
  lastSeq: number,
): Promise<{ rows: ServerRow[]; more: boolean }> => {
  const limit = MAX_ROWS_PER_RESPONSE;
  const all = await readSince(repos, lastSeq, limit + 1);

  if (all.length <= limit) return { rows: all, more: false };

  const cutSeq = all[limit - 1]?.seq ?? 0;
  if (all[limit]?.seq !== cutSeq)
    return { rows: all.slice(0, limit), more: true };
  const whole = all.filter((row) => row.seq < cutSeq);
  if (whole.length > 0) return { rows: whole, more: true };
  // One seq holds more rows than a response (a merge moving many children): send it whole, since
  // the next pull starts after it.
  const atCut = await readSince(repos, cutSeq - 1, Number.MAX_SAFE_INTEGER);
  return { rows: atCut.filter((row) => row.seq === cutSeq), more: true };
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
    return {
      acknowledged,
      rows,
      seq,
      hlc: highestHlc(hlc, rows),
      ...(more && { more }),
    };
  });
};
