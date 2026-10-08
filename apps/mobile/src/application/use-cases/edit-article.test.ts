import type { ArticleId } from '../../domain/article';
import type { CategoryId } from '../../domain/category';
import { err, ok } from '../../domain/result';
import type { ListId } from '../../domain/shopping-list';
import type { UnitOfWork } from '../ports/unit-of-work';
import {
  InMemoryRepositories,
  InMemoryUnitOfWork,
} from '../testing/in-memory-repositories';
import { createEditArticle } from './edit-article';
import { createGetCatalog } from './get-catalog';
import { createGetCurrentList } from './get-current-list';

const maListe = 'l-1' as ListId;
const barbecue = 'l-2' as ListId;
const fruits = 'c-1' as CategoryId;
const cremerie = 'c-2' as CategoryId;
const lait = 'a-1' as ArticleId;
const beurre = 'a-2' as ArticleId;
const pommesDeTerre = 'a-3' as ArticleId;
const pommes = 'a-4' as ArticleId;

describe('editArticle', () => {
  let unitOfWork: UnitOfWork;
  let editArticle: ReturnType<typeof createEditArticle>;
  const articles = () => unitOfWork.run((repos) => repos.articles.all());
  const itemsOf = (listId: ListId) =>
    unitOfWork.run((repos) => repos.items.forList(listId));
  const catalog = (listId: ListId, query?: string) =>
    createGetCatalog({ unitOfWork })(listId, query);
  const catalogNames = async (listId: ListId) =>
    (await catalog(listId)).sections.flatMap((section) =>
      section.articles.map((article) => article.name),
    );

  beforeEach(async () => {
    unitOfWork = new InMemoryUnitOfWork(new InMemoryRepositories());
    editArticle = createEditArticle({ unitOfWork });
    await unitOfWork.run(async (repos) => {
      await repos.categories.add({
        id: fruits,
        name: 'Fruits et légumes',
        position: 0,
      });
      await repos.categories.add({
        id: cremerie,
        name: 'Crèmerie',
        position: 1,
      });
      await repos.articles.add({
        id: lait,
        name: 'Lait',
        categoryId: cremerie,
      });
      await repos.articles.add({
        id: beurre,
        name: 'Beurre',
        categoryId: cremerie,
      });
      await repos.articles.add({
        id: pommesDeTerre,
        name: 'Pommes de terre',
        categoryId: fruits,
      });
      await repos.articles.add({
        id: pommes,
        name: 'Pommes',
        categoryId: fruits,
      });
      await repos.lists.add({ id: maListe, name: 'Ma liste' });
      await repos.lists.add({ id: barbecue, name: 'Barbecue' });
      await repos.items.save({
        listId: maListe,
        articleId: lait,
        inCart: true,
        quantity: { amount: 2, unit: 'L' },
      });
      await repos.items.save({
        listId: barbecue,
        articleId: lait,
        inCart: false,
        quantity: null,
      });
      await repos.appState.setCurrentListId(maListe);
    });
  });

  it('US1-1 FR-001 shows the new name in the catalog and not the old one', async () => {
    const outcome = await editArticle(lait, {
      name: 'Lait demi-écrémé',
      categoryId: cremerie,
    });

    expect(outcome).toEqual(ok(undefined));
    const names = await catalogNames(maListe);
    expect(names).toContain('Lait demi-écrémé');
    expect(names).not.toContain('Lait');
  });

  it('US1-2 FR-002 shows the new name on both lists, each keeping its quantity and ticked state', async () => {
    await editArticle(lait, { name: 'Lait demi-écrémé', categoryId: cremerie });

    expect(await itemsOf(maListe)).toEqual([
      {
        listId: maListe,
        articleId: lait,
        inCart: true,
        quantity: { amount: 2, unit: 'L' },
      },
    ]);
    expect(await itemsOf(barbecue)).toEqual([
      { listId: barbecue, articleId: lait, inCart: false, quantity: null },
    ]);
    for (const listId of [maListe, barbecue]) {
      const onList = (await catalog(listId)).sections
        .flatMap((section) => section.articles)
        .find((article) => article.id === lait);
      expect(onList).toMatchObject({
        name: 'Lait demi-écrémé',
        onList: true,
      });
    }
  });

  it('US1-3 searching "demi" and "Lait" both find the renamed article', async () => {
    await editArticle(lait, { name: 'Lait demi-écrémé', categoryId: cremerie });

    for (const query of ['demi', 'Lait']) {
      const found = (await catalog(maListe, query)).sections.flatMap(
        (section) => section.articles.map((article) => article.name),
      );
      expect(found).toEqual(['Lait demi-écrémé']);
    }
  });

  it('US1-4 FR-008 refuses " beurre " with NameAlreadyUsed carrying "Beurre", writing nothing', async () => {
    const before = await articles();

    const outcome = await editArticle(lait, {
      name: ' beurre ',
      categoryId: cremerie,
    });

    expect(outcome).toEqual(
      err({
        type: 'NameAlreadyUsed',
        existing: { id: beurre, name: 'Beurre', categoryId: cremerie },
      }),
    );
    expect(await articles()).toEqual(before);
  });

  it('US1-5 FR-008a accepts the own name in another case: "Lait" to "lait"', async () => {
    const outcome = await editArticle(lait, {
      name: 'lait',
      categoryId: cremerie,
    });

    expect(outcome).toEqual(ok(undefined));
    expect(await catalogNames(maListe)).toContain('lait');
  });

  it('US1-5 FR-008a accepts the own name with other spaces: "Pommes de terre" to "Pommes  de terre"', async () => {
    const outcome = await editArticle(pommesDeTerre, {
      name: 'Pommes  de terre',
      categoryId: fruits,
    });

    expect(outcome).toEqual(ok(undefined));
    expect((await articles()).map((article) => article.name)).toContain(
      'Pommes de terre',
    );
  });

  it('US1-6 refuses a blank name with NameRequired, writing nothing', async () => {
    const before = await articles();

    expect(
      await editArticle(lait, { name: '   ', categoryId: cremerie }),
    ).toEqual(err({ type: 'NameRequired' }));
    expect(await articles()).toEqual(before);
  });

  it('US1-6 refuses a name of 61 characters with NameTooLong, writing nothing', async () => {
    const before = await articles();

    expect(
      await editArticle(lait, { name: 'a'.repeat(61), categoryId: cremerie }),
    ).toEqual(err({ type: 'NameTooLong' }));
    expect(await articles()).toEqual(before);
  });

  it('US1-8 moves the item to its new alphabetical place in its category', async () => {
    await unitOfWork.run((repos) =>
      repos.items.save({
        listId: maListe,
        articleId: beurre,
        inCart: false,
        quantity: null,
      }),
    );
    const order = async () =>
      (await catalog(maListe)).sections
        .find((section) => section.category.id === cremerie)
        ?.articles.map((article) => article.name);
    expect(await order()).toEqual(['Beurre', 'Lait']);

    await editArticle(lait, { name: 'Ail', categoryId: cremerie });

    expect(await order()).toEqual(['Ail', 'Beurre']);
  });

  it('returns ArticleNotFound for an unknown article, writing nothing', async () => {
    const before = await articles();

    expect(
      await editArticle('a-unknown' as ArticleId, {
        name: 'Crème',
        categoryId: cremerie,
      }),
    ).toEqual(err({ type: 'ArticleNotFound' }));
    expect(await articles()).toEqual(before);
  });

  it('FR-022 stores the name cleaned: "  Lait   demi-écrémé " becomes "Lait demi-écrémé"', async () => {
    await editArticle(lait, {
      name: '  Lait   demi-écrémé ',
      categoryId: cremerie,
    });

    expect(await articles()).toContainEqual({
      id: lait,
      name: 'Lait demi-écrémé',
      categoryId: cremerie,
    });
  });

  describe('changing the category (US3)', () => {
    const epicerie = 'c-3' as CategoryId;
    const houmous = 'a-5' as ArticleId;
    const sectionOf = async (listId: ListId, categoryId: CategoryId) =>
      (await catalog(listId)).sections.find(
        (section) => section.category.id === categoryId,
      );

    beforeEach(async () => {
      await unitOfWork.run(async (repos) => {
        await repos.categories.add({
          id: epicerie,
          name: 'Épicerie salée',
          position: 2,
        });
        await repos.articles.add({
          id: houmous,
          name: 'Houmous',
          categoryId: epicerie,
        });
        await repos.items.save({
          listId: maListe,
          articleId: houmous,
          inCart: true,
          quantity: { amount: 1, unit: 'kg' },
        });
      });
    });

    it('US3-1 moves "Houmous" to "Crèmerie" in the catalog and on the list, keeping its quantity and ticked state', async () => {
      const outcome = await editArticle(houmous, {
        name: 'Houmous',
        categoryId: cremerie,
      });

      expect(outcome).toEqual(ok(undefined));
      expect(
        (await sectionOf(maListe, cremerie))?.articles.map((a) => a.name),
      ).toContain('Houmous');
      expect(
        (await sectionOf(maListe, epicerie))?.articles.map((a) => a.name) ?? [],
      ).not.toContain('Houmous');
      expect(await itemsOf(maListe)).toContainEqual({
        listId: maListe,
        articleId: houmous,
        inCart: true,
        quantity: { amount: 1, unit: 'kg' },
      });
    });

    it('US3-2 drops the section of the old category from the list view when it was its only item there', async () => {
      const sectionIds = async () =>
        (await createGetCurrentList({ unitOfWork })()).sections.map(
          (section) => section.category.id,
        );
      expect(await sectionIds()).toContain(epicerie);

      await editArticle(houmous, { name: 'Houmous', categoryId: cremerie });

      const after = await sectionIds();
      expect(after).not.toContain(epicerie);
      expect(after).toContain(cremerie);
    });

    it('US3-3 FR-009 applies name and category together, and with a taken name neither', async () => {
      const moved = await editArticle(houmous, {
        name: 'Houmous nature',
        categoryId: cremerie,
      });
      expect(moved).toEqual(ok(undefined));
      expect(await articles()).toContainEqual({
        id: houmous,
        name: 'Houmous nature',
        categoryId: cremerie,
      });

      const before = await articles();
      const refused = await editArticle(houmous, {
        name: 'beurre',
        categoryId: fruits,
      });
      expect(refused.ok).toBe(false);
      expect(await articles()).toEqual(before);
    });

    it('reports a taken name before an unknown category, so the fixable error is shown', async () => {
      const outcome = await editArticle(houmous, {
        name: 'beurre',
        categoryId: 'c-unknown' as CategoryId,
      });

      expect(outcome).toMatchObject({
        ok: false,
        error: { type: 'NameAlreadyUsed' },
      });
    });

    it('FR-008 returns CategoryNotFound for an unknown category, writing nothing', async () => {
      const before = await articles();

      expect(
        await editArticle(houmous, {
          name: 'Houmous',
          categoryId: 'c-unknown' as CategoryId,
        }),
      ).toEqual(err({ type: 'CategoryNotFound' }));
      expect(await articles()).toEqual(before);
    });
  });
});
