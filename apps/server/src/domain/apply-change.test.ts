import type { Change, Hlc } from '@mes-courses/sync-core';

import type {
  ArticleRecord,
  CategoryRecord,
  ListItemRecord,
  ListRecord,
} from './records';
import { applyChange } from './apply-change';

const hlc = (wallMs: number, deviceId = 'd-1'): Hlc => ({
  wallMs,
  counter: 0,
  deviceId,
});

const category = (overrides: Partial<CategoryRecord> = {}): CategoryRecord => ({
  id: 'c-1',
  name: 'Fruits',
  nameHlc: hlc(10),
  normalizedName: 'fruits',
  position: 0,
  positionHlc: hlc(10),
  createdHlc: hlc(10),
  deletedHlc: null,
  mergedInto: null,
  seq: 1,
  ...overrides,
});

const article = (overrides: Partial<ArticleRecord> = {}): ArticleRecord => ({
  id: 'a-1',
  name: 'Pommes',
  nameHlc: hlc(10),
  normalizedName: 'pommes',
  categoryId: 'c-1',
  categoryHlc: hlc(10),
  createdHlc: hlc(10),
  deletedHlc: null,
  mergedInto: null,
  seq: 1,
  ...overrides,
});

const list = (overrides: Partial<ListRecord> = {}): ListRecord => ({
  id: 'l-1',
  name: 'Ma liste',
  nameHlc: hlc(10),
  normalizedName: 'ma liste',
  createdHlc: hlc(10),
  deletedHlc: null,
  mergedInto: null,
  seq: 1,
  ...overrides,
});

const item = (overrides: Partial<ListItemRecord> = {}): ListItemRecord => ({
  listId: 'l-1',
  articleId: 'a-1',
  present: true,
  presentHlc: hlc(10),
  inCart: false,
  inCartHlc: hlc(10),
  quantity: null,
  quantityHlc: hlc(10),
  seq: 1,
  ...overrides,
});

describe('applyChange', () => {
  describe('creates', () => {
    it('sets every field of a category with its HLC and createdHlc', () => {
      const change: Change = {
        changeId: 'ch-1',
        hlc: hlc(20),
        kind: 'category',
        id: 'c-2',
        fields: { name: 'Légumes', position: 3 },
      };

      expect(applyChange(null, change, 7)).toEqual({
        id: 'c-2',
        name: 'Légumes',
        nameHlc: hlc(20),
        normalizedName: 'légumes',
        position: 3,
        positionHlc: hlc(20),
        createdHlc: hlc(20),
        deletedHlc: null,
        mergedInto: null,
        seq: 7,
      });
    });

    it('sets every field of an article', () => {
      const change: Change = {
        changeId: 'ch-1',
        hlc: hlc(20),
        kind: 'article',
        id: 'a-2',
        fields: { name: 'Poires', categoryId: 'c-1' },
      };

      expect(applyChange(null, change, 4)).toEqual({
        id: 'a-2',
        name: 'Poires',
        nameHlc: hlc(20),
        normalizedName: 'poires',
        categoryId: 'c-1',
        categoryHlc: hlc(20),
        createdHlc: hlc(20),
        deletedHlc: null,
        mergedInto: null,
        seq: 4,
      });
    });

    it('sets every field of a list', () => {
      const change: Change = {
        changeId: 'ch-1',
        hlc: hlc(20),
        kind: 'list',
        id: 'l-2',
        fields: { name: 'Fête' },
      };

      expect(applyChange(null, change, 2)).toEqual({
        id: 'l-2',
        name: 'Fête',
        nameHlc: hlc(20),
        normalizedName: 'fête',
        createdHlc: hlc(20),
        deletedHlc: null,
        mergedInto: null,
        seq: 2,
      });
    });

    it('sets every field of a list item', () => {
      const change: Change = {
        changeId: 'ch-1',
        hlc: hlc(20),
        kind: 'listItem',
        id: 'l-1:a-1',
        fields: {
          listId: 'l-1',
          articleId: 'a-1',
          present: true,
          inCart: false,
          quantity: { amount: 2, unit: 'kg' },
        },
      };

      expect(applyChange(null, change, 5)).toEqual({
        listId: 'l-1',
        articleId: 'a-1',
        present: true,
        presentHlc: hlc(20),
        inCart: false,
        inCartHlc: hlc(20),
        quantity: { amount: 2, unit: 'kg' },
        quantityHlc: hlc(20),
        seq: 5,
      });
    });
  });

  describe('updates', () => {
    it('writes a field when the incoming stamp is greater', () => {
      const change: Change = {
        changeId: 'ch-1',
        hlc: hlc(20),
        kind: 'list',
        id: 'l-1',
        fields: { name: 'Courses' },
      };

      expect(applyChange(list(), change, 9)).toEqual(
        list({
          name: 'Courses',
          nameHlc: hlc(20),
          normalizedName: 'courses',
          seq: 9,
        }),
      );
    });

    it('keeps a field whose current stamp is greater, and leaves the row untouched', () => {
      const current = list({ nameHlc: hlc(30) });
      const change: Change = {
        changeId: 'ch-1',
        hlc: hlc(20),
        kind: 'list',
        id: 'l-1',
        fields: { name: 'Courses' },
      };

      const result = applyChange(current, change, 9);

      expect(result).toBe(current);
      expect(result).toHaveProperty('seq', 1);
    });

    it('FR-009 keeps changes to different fields', () => {
      const first: Change = {
        changeId: 'ch-1',
        hlc: hlc(20, 'd-1'),
        kind: 'article',
        id: 'a-1',
        fields: { name: 'Pommes bio' },
      };
      const second: Change = {
        changeId: 'ch-2',
        hlc: hlc(15, 'd-2'),
        kind: 'article',
        id: 'a-1',
        fields: { categoryId: 'c-2' },
      };

      const afterFirst = applyChange(article(), first, 2);
      const result = applyChange(afterFirst, second, 3) as ArticleRecord;

      expect(result).toMatchObject({
        name: 'Pommes bio',
        nameHlc: hlc(20, 'd-1'),
        categoryId: 'c-2',
        categoryHlc: hlc(15, 'd-2'),
        seq: 3,
      });
    });

    it('keeps the greater stamp whatever the arrival order', () => {
      const older: Change = {
        changeId: 'ch-1',
        hlc: hlc(15, 'd-2'),
        kind: 'category',
        id: 'c-1',
        fields: { name: 'Primeurs' },
      };
      const newer: Change = {
        changeId: 'ch-2',
        hlc: hlc(20, 'd-1'),
        kind: 'category',
        id: 'c-1',
        fields: { name: 'Fruits frais' },
      };

      const a = applyChange(applyChange(category(), older, 2), newer, 3);
      const b = applyChange(applyChange(category(), newer, 2), older, 3);

      expect(a).toMatchObject({ name: 'Fruits frais' });
      expect(b).toMatchObject({ name: 'Fruits frais' });
    });
  });

  describe('list items', () => {
    it('FR-011 does not reset present = false with an inCart change', () => {
      const removed = item({ present: false, presentHlc: hlc(20) });
      const change: Change = {
        changeId: 'ch-1',
        hlc: hlc(30),
        kind: 'listItem',
        id: 'l-1:a-1',
        fields: { inCart: true },
      };

      expect(applyChange(removed, change, 3)).toMatchObject({
        present: false,
        presentHlc: hlc(20),
        inCart: true,
        inCartHlc: hlc(30),
      });
    });

    it('FR-011 does not reset present = false with a quantity change', () => {
      const removed = item({ present: false, presentHlc: hlc(20) });
      const change: Change = {
        changeId: 'ch-1',
        hlc: hlc(30),
        kind: 'listItem',
        id: 'l-1:a-1',
        fields: { quantity: { amount: 3, unit: null } },
      };

      expect(applyChange(removed, change, 3)).toMatchObject({
        present: false,
        quantity: { amount: 3, unit: null },
        quantityHlc: hlc(30),
      });
    });

    it('puts a removed item back with a greater present stamp', () => {
      const removed = item({ present: false, presentHlc: hlc(20) });
      const change: Change = {
        changeId: 'ch-1',
        hlc: hlc(30),
        kind: 'listItem',
        id: 'l-1:a-1',
        fields: { present: true },
      };

      expect(applyChange(removed, change, 3)).toMatchObject({
        present: true,
        presentHlc: hlc(30),
      });
    });
  });

  describe('deleted articles', () => {
    it('FR-011 sets deletedHlc on article.deleted', () => {
      const change: Change = {
        changeId: 'ch-1',
        hlc: hlc(20),
        kind: 'article',
        id: 'a-1',
        fields: { deleted: true },
      };

      expect(applyChange(article(), change, 6)).toEqual(
        article({ deletedHlc: hlc(20), seq: 6 }),
      );
    });

    it('FR-011 ignores any later change to a deleted article', () => {
      const deleted = article({ deletedHlc: hlc(20) });
      const rename: Change = {
        changeId: 'ch-1',
        hlc: hlc(30),
        kind: 'article',
        id: 'a-1',
        fields: { name: 'Autre', categoryId: 'c-9' },
      };
      const deleteAgain: Change = {
        changeId: 'ch-2',
        hlc: hlc(40),
        kind: 'article',
        id: 'a-1',
        fields: { deleted: true },
      };

      expect(applyChange(deleted, rename, 7)).toBe(deleted);
      expect(applyChange(deleted, deleteAgain, 8)).toBe(deleted);
    });
  });

  describe('unknown entities', () => {
    it('ignores an update for an entity that does not exist', () => {
      const changes: Change[] = [
        {
          changeId: 'ch-1',
          hlc: hlc(20),
          kind: 'article',
          id: 'a-9',
          fields: { name: 'Fantôme' },
        },
        {
          changeId: 'ch-2',
          hlc: hlc(20),
          kind: 'listItem',
          id: 'l-1:a-9',
          fields: { inCart: true },
        },
        {
          changeId: 'ch-3',
          hlc: hlc(20),
          kind: 'article',
          id: 'a-9',
          fields: { deleted: true },
        },
      ];

      for (const change of changes) {
        expect(applyChange(null, change, 3)).toBeNull();
      }
    });
  });
});
