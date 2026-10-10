import {
  mergeField,
  normalizedName,
  type Change,
  type FieldValue,
  type Hlc,
} from '@mes-courses/sync-core';

import type {
  ArticleRecord,
  CategoryRecord,
  ListItemRecord,
  ListRecord,
} from './records';

type Record_ = CategoryRecord | ArticleRecord | ListRecord | ListItemRecord;

type Merged<T> = { value: T; hlc: Hlc; changed: boolean };

/** Keeps the greater stamp of the stored field and the incoming one. */
const merge = <T>(
  current: FieldValue<T>,
  incoming: FieldValue<T>,
): Merged<T> => {
  const winner = mergeField(current, incoming);
  return { ...winner, changed: winner === incoming };
};

const created = (
  change: Change,
): Pick<CategoryRecord, 'createdHlc' | 'deletedHlc' | 'mergedInto'> => ({
  createdHlc: change.hlc,
  deletedHlc: null,
  mergedInto: null,
});

const createRecord = (change: Change, seq: number): Record_ | null => {
  const { hlc } = change;
  switch (change.kind) {
    case 'category': {
      const { name, position } = change.fields;
      if (name === undefined || position === undefined) return null;
      return {
        id: change.id,
        name,
        nameHlc: hlc,
        normalizedName: normalizedName(name),
        position,
        positionHlc: hlc,
        ...created(change),
        seq,
      };
    }
    case 'article': {
      const { name, categoryId } = change.fields;
      if (name === undefined || categoryId === undefined) return null;
      return {
        id: change.id,
        name,
        nameHlc: hlc,
        normalizedName: normalizedName(name),
        categoryId,
        categoryHlc: hlc,
        ...created(change),
        seq,
      };
    }
    case 'list': {
      const { name } = change.fields;
      if (name === undefined) return null;
      return {
        id: change.id,
        name,
        nameHlc: hlc,
        normalizedName: normalizedName(name),
        ...created(change),
        seq,
      };
    }
    case 'listItem': {
      const { listId, articleId, present, inCart, quantity } = change.fields;
      if (
        listId === undefined ||
        articleId === undefined ||
        present === undefined ||
        inCart === undefined ||
        quantity === undefined
      ) {
        return null;
      }
      return {
        listId,
        articleId,
        present,
        presentHlc: hlc,
        inCart,
        inCartHlc: hlc,
        quantity,
        quantityHlc: hlc,
        seq,
      };
    }
  }
};

const updateRecord = (
  current: Record_,
  change: Change,
  seq: number,
): Record_ => {
  const incomingHlc = change.hlc;
  switch (change.kind) {
    case 'category': {
      const row = current as CategoryRecord;
      const name =
        change.fields.name === undefined
          ? null
          : merge(
              { value: row.name, hlc: row.nameHlc },
              { value: change.fields.name, hlc: incomingHlc },
            );
      const position =
        change.fields.position === undefined
          ? null
          : merge(
              { value: row.position, hlc: row.positionHlc },
              { value: change.fields.position, hlc: incomingHlc },
            );
      if (!name?.changed && !position?.changed) return current;
      return {
        ...row,
        ...(name?.changed && {
          name: name.value,
          nameHlc: name.hlc,
          normalizedName: normalizedName(name.value),
        }),
        ...(position?.changed && {
          position: position.value,
          positionHlc: position.hlc,
        }),
        seq,
      };
    }
    case 'article': {
      const row = current as ArticleRecord;
      if (row.deletedHlc !== null) return current;
      if (change.fields.deleted) {
        return { ...row, deletedHlc: incomingHlc, seq };
      }
      const name =
        change.fields.name === undefined
          ? null
          : merge(
              { value: row.name, hlc: row.nameHlc },
              { value: change.fields.name, hlc: incomingHlc },
            );
      const category =
        change.fields.categoryId === undefined
          ? null
          : merge(
              { value: row.categoryId, hlc: row.categoryHlc },
              { value: change.fields.categoryId, hlc: incomingHlc },
            );
      if (!name?.changed && !category?.changed) return current;
      return {
        ...row,
        ...(name?.changed && {
          name: name.value,
          nameHlc: name.hlc,
          normalizedName: normalizedName(name.value),
        }),
        ...(category?.changed && {
          categoryId: category.value,
          categoryHlc: category.hlc,
        }),
        seq,
      };
    }
    case 'list': {
      const row = current as ListRecord;
      if (change.fields.name === undefined) return current;
      const name = merge(
        { value: row.name, hlc: row.nameHlc },
        { value: change.fields.name, hlc: incomingHlc },
      );
      if (!name.changed) return current;
      return {
        ...row,
        name: name.value,
        nameHlc: name.hlc,
        normalizedName: normalizedName(name.value),
        seq,
      };
    }
    case 'listItem': {
      const row = current as ListItemRecord;
      const present =
        change.fields.present === undefined
          ? null
          : merge(
              { value: row.present, hlc: row.presentHlc },
              { value: change.fields.present, hlc: incomingHlc },
            );
      const inCart =
        change.fields.inCart === undefined
          ? null
          : merge(
              { value: row.inCart, hlc: row.inCartHlc },
              { value: change.fields.inCart, hlc: incomingHlc },
            );
      const quantity =
        change.fields.quantity === undefined
          ? null
          : merge(
              { value: row.quantity, hlc: row.quantityHlc },
              { value: change.fields.quantity, hlc: incomingHlc },
            );
      if (!present?.changed && !inCart?.changed && !quantity?.changed) {
        return current;
      }
      return {
        ...row,
        ...(present?.changed && {
          present: present.value,
          presentHlc: present.hlc,
        }),
        ...(inCart?.changed && {
          inCart: inCart.value,
          inCartHlc: inCart.hlc,
        }),
        ...(quantity?.changed && {
          quantity: quantity.value,
          quantityHlc: quantity.hlc,
        }),
        seq,
      };
    }
  }
};

/**
 * The row after the change: a new row for a create, the same object when the change has no effect
 * (a lost field, a deleted article), `null` for an update of an unknown row.
 */
export const applyChange = (
  current: Record_ | null,
  change: Change,
  seq: number,
): Record_ | null =>
  current === null
    ? createRecord(change, seq)
    : updateRecord(current, change, seq);
