import { type Change, type Hlc } from '@mes-courses/sync-core';

import { applyChange } from '../../domain/apply-change';
import {
  createdAtJoin,
  mergeItems,
  mergeOrder,
  tombstoneMerged,
} from '../../domain/merge-by-name';
import type {
  ArticleRecord,
  CategoryRecord,
  EntityRecord,
  EntityRepository,
  ListItemRecord,
  ListRecord,
  Repositories,
} from '../ports/store';

type AnyRecord = CategoryRecord | ArticleRecord | ListRecord | ListItemRecord;

/** A chain of merges is short; the bound only stops a cycle in damaged data. */
const MAX_HOPS = 100;

const itemKey = (id: string): [string, string] => {
  const at = id.indexOf(':');
  return [id.slice(0, at), id.slice(at + 1)];
};

/** Where an id ended up after the merges, following chains (research R8). */
const survivorOf = async (
  repo: EntityRepository<EntityRecord>,
  id: string,
): Promise<string> => {
  let current = id;
  for (let hops = 0; hops < MAX_HOPS; hops += 1) {
    const row = await repo.get(current);
    if (row?.mergedInto == null) return current;
    current = row.mergedInto;
  }
  return current;
};

/** The change aimed at the survivors of the ids it names (research R8). */
const redirect = async (
  repos: Repositories,
  change: Change,
): Promise<Change> => {
  switch (change.kind) {
    case 'category':
      return { ...change, id: await survivorOf(repos.categories, change.id) };
    case 'list':
      return { ...change, id: await survivorOf(repos.lists, change.id) };
    case 'article': {
      const { categoryId } = change.fields;
      return {
        ...change,
        id: await survivorOf(repos.articles, change.id),
        fields: {
          ...change.fields,
          ...(categoryId !== undefined && {
            categoryId: await survivorOf(repos.categories, categoryId),
          }),
        },
      };
    }
    case 'listItem': {
      const [listId, articleId] = itemKey(change.id);
      const list = await survivorOf(repos.lists, listId);
      const article = await survivorOf(repos.articles, articleId);
      return {
        ...change,
        id: `${list}:${article}`,
        fields: {
          ...change.fields,
          ...(change.fields.listId !== undefined && { listId: list }),
          ...(change.fields.articleId !== undefined && { articleId: article }),
        },
      };
    }
  }
};

const load = (
  repos: Repositories,
  change: Change,
): Promise<AnyRecord | null> => {
  switch (change.kind) {
    case 'category':
      return repos.categories.get(change.id);
    case 'article':
      return repos.articles.get(change.id);
    case 'list':
      return repos.lists.get(change.id);
    case 'listItem':
      return repos.items.get(...itemKey(change.id));
  }
};

const save = (
  repos: Repositories,
  change: Change,
  record: AnyRecord,
): Promise<void> => {
  switch (change.kind) {
    case 'category':
      return repos.categories.save(record as CategoryRecord);
    case 'article':
      return repos.articles.save(record as ArticleRecord);
    case 'list':
      return repos.lists.save(record as ListRecord);
    case 'listItem':
      return repos.items.save(record as ListItemRecord);
  }
};

/** Moves the items of a merged article or list, merging those the survivor already has. */
const moveItems = async (
  repos: Repositories,
  items: ListItemRecord[],
  target: (item: ListItemRecord) => { listId: string; articleId: string },
  hlc: Hlc,
  seq: number,
) => {
  for (const item of items) {
    const to = target(item);
    const existing = await repos.items.get(to.listId, to.articleId);
    const merged = mergeItems(item, existing, to, hlc, seq);
    if (merged.survivor) await repos.items.save(merged.survivor);
    if (merged.loser) await repos.items.save(merged.loser);
  }
};

/** Saves the live children of a surviving entity again at `seq`, so they travel with it. */
const resendChildren = async (
  repos: Repositories,
  kind: 'category' | 'article' | 'list',
  survivorId: string,
  seq: number,
) => {
  const resendItems = async (items: ListItemRecord[]) => {
    for (const item of items) {
      if (item.present) await repos.items.save({ ...item, seq });
    }
  };
  if (kind === 'category') {
    for (const article of await repos.articles.inCategory(survivorId)) {
      if (article.deletedHlc !== null) continue;
      await repos.articles.save({ ...article, seq });
      await resendItems(await repos.items.forArticle(article.id));
    }
  } else if (kind === 'article') {
    await resendItems(await repos.items.forArticle(survivorId));
  } else {
    await resendItems(await repos.items.forList(survivorId));
  }
};

/**
 * Saves the record. When it gives a live category, article or list the name of another live one,
 * the two are merged in this same transaction (research R8): the loser becomes a tombstone first,
 * which frees the name, then what it held moves to the survivor.
 */
const saveMerging = async (
  repos: Repositories,
  change: Change,
  record: AnyRecord,
  seq: number,
) => {
  if (change.kind === 'listItem') return save(repos, change, record);
  const entity = record as EntityRecord;
  const repo = (
    change.kind === 'category'
      ? repos.categories
      : change.kind === 'article'
        ? repos.articles
        : repos.lists
  ) as EntityRepository<EntityRecord>;
  const other =
    entity.deletedHlc === null
      ? await repo.findLiveByNormalizedName(entity.normalizedName)
      : null;
  if (other === null || other.id === entity.id) {
    return save(repos, change, record);
  }

  const { survivor, loser } = mergeOrder(entity, other);
  await repo.save(tombstoneMerged(loser, survivor.id, change.hlc, seq));
  // A survivor that already existed is saved again at this seq, so devices that skipped it
  // (a name clash with a row of theirs) receive it together with the loser's tombstone.
  const kept = survivor === entity ? entity : { ...survivor, seq };
  await repo.save(kept);
  if (survivor !== entity)
    await resendChildren(repos, change.kind, survivor.id, seq);

  switch (change.kind) {
    case 'category':
      for (const article of await repos.articles.inCategory(loser.id)) {
        if (article.deletedHlc !== null) continue;
        await repos.articles.save({
          ...article,
          categoryId: survivor.id,
          categoryHlc: change.hlc,
          seq,
        });
      }
      return;
    case 'article':
      return moveItems(
        repos,
        await repos.items.forArticle(loser.id),
        (item) => ({ listId: item.listId, articleId: survivor.id }),
        change.hlc,
        seq,
      );
    case 'list':
      return moveItems(
        repos,
        await repos.items.forList(loser.id),
        (item) => ({ listId: survivor.id, articleId: item.articleId }),
        change.hlc,
        seq,
      );
  }
};

/**
 * Applies one change: aimed at the survivors of the ids it names, merged field by field into the
 * stored row, and merged by name with any live entity it now collides with. Every row it touches
 * gets the change's `seq`. A change with no effect writes nothing.
 */
export const applyWithMerge = async (
  repos: Repositories,
  incoming: Change,
  serverNowMs: number,
): Promise<void> => {
  const change = await redirect(repos, incoming);
  const current = await load(repos, change);
  const seq = (await repos.meta.currentSeq()) + 1;
  const applied = applyChange(current, change, seq);
  if (applied === null || applied === current) return;
  const record =
    current === null && change.kind !== 'listItem'
      ? {
          ...applied,
          createdHlc: createdAtJoin(
            (applied as EntityRecord).createdHlc,
            serverNowMs,
          ),
        }
      : applied;
  await repos.meta.nextSeq();
  await saveMerging(repos, change, record, seq);
};
