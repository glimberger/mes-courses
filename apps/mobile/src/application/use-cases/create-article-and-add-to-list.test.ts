import type { ArticleId } from '../../domain/article';
import type { CategoryId } from '../../domain/category';
import { err, ok } from '../../domain/result';
import type { ListId } from '../../domain/shopping-list';
import type { UnitOfWork } from '../ports/unit-of-work';
import {
  InMemoryRepositories,
  InMemoryUnitOfWork,
} from '../testing/in-memory-repositories';
import { SequentialIdGenerator } from '../testing/sequential-id-generator';
import { createCreateArticleAndAddToList } from './create-article-and-add-to-list';

const maListe = 'l-1' as ListId;
const epicerie = 'c-1' as CategoryId;
const cremerie = 'c-2' as CategoryId;
const beurre = { id: 'a-1' as ArticleId, name: 'Beurre', categoryId: cremerie };
const pommesDeTerre = {
  id: 'a-2' as ArticleId,
  name: 'Pommes de terre',
  categoryId: epicerie,
};
const oeufs = { id: 'a-3' as ArticleId, name: 'Œufs', categoryId: cremerie };

describe('createArticleAndAddToList', () => {
  let unitOfWork: UnitOfWork;
  let createArticleAndAddToList: ReturnType<
    typeof createCreateArticleAndAddToList
  >;
  const articles = () => unitOfWork.run((repos) => repos.articles.all());
  const items = () => unitOfWork.run((repos) => repos.items.forList(maListe));

  beforeEach(async () => {
    unitOfWork = new InMemoryUnitOfWork(new InMemoryRepositories());
    createArticleAndAddToList = createCreateArticleAndAddToList({
      unitOfWork,
      ids: new SequentialIdGenerator(),
    });
    await unitOfWork.run(async (repos) => {
      await repos.categories.add({
        id: epicerie,
        name: 'Épicerie salée',
        position: 0,
      });
      await repos.categories.add({
        id: cremerie,
        name: 'Crèmerie',
        position: 1,
      });
      for (const article of [beurre, pommesDeTerre, oeufs]) {
        await repos.articles.add(article);
      }
      await repos.lists.add({ id: maListe, name: 'Ma liste' });
      await repos.appState.setCurrentListId(maListe);
    });
  });

  it('US2-7 FR-018 creates the article in its category and adds it unticked, with its quantity', async () => {
    const outcome = await createArticleAndAddToList(
      maListe,
      { name: 'Houmous', categoryId: epicerie },
      { amount: 2, unit: 'pots' },
    );

    expect(outcome).toEqual(ok({ articleId: 'id-1' }));
    expect(await articles()).toContainEqual({
      id: 'id-1',
      name: 'Houmous',
      categoryId: epicerie,
    });
    expect(await items()).toEqual([
      {
        listId: maListe,
        articleId: 'id-1',
        inCart: false,
        quantity: { amount: 2, unit: 'pots' },
      },
    ]);
  });

  it('US2-7 creates and adds in one transaction: nothing is kept when adding fails', async () => {
    const failing: UnitOfWork = {
      run: (work) =>
        unitOfWork.run((repos) =>
          work({
            ...repos,
            items: {
              ...repos.items,
              save: () => Promise.reject(new Error('disk failed')),
            },
          }),
        ),
    };

    await expect(
      createCreateArticleAndAddToList({
        unitOfWork: failing,
        ids: new SequentialIdGenerator(),
      })(maListe, { name: 'Houmous', categoryId: epicerie }, null),
    ).rejects.toThrow('disk failed');

    expect(await articles()).toHaveLength(3);
  });

  it('FR-022 stores the name cleaned: "  Houmous   maison " is created as "Houmous maison"', async () => {
    await createArticleAndAddToList(
      maListe,
      { name: '  Houmous   maison ', categoryId: epicerie },
      null,
    );

    expect((await articles()).map((article) => article.name)).toContain(
      'Houmous maison',
    );
  });

  it.each([
    [' beurre ', beurre],
    ['pommes  de  terre', pommesDeTerre],
    ['Oeufs', oeufs],
  ])(
    'US2-9 FR-021 refuses "%s" with NameAlreadyUsed carrying the existing article, creating nothing',
    async (name, existing) => {
      const outcome = await createArticleAndAddToList(
        maListe,
        { name, categoryId: epicerie },
        null,
      );

      expect(outcome).toEqual(err({ type: 'NameAlreadyUsed', existing }));
      expect(await articles()).toHaveLength(3);
      expect(await items()).toEqual([]);
    },
  );

  it('US2-11 refuses a blank name with NameRequired', async () => {
    const outcome = await createArticleAndAddToList(
      maListe,
      { name: '   ', categoryId: epicerie },
      null,
    );

    expect(outcome).toEqual(err({ type: 'NameRequired' }));
    expect(await articles()).toHaveLength(3);
  });

  it('FR-022 refuses a name of 61 characters with NameTooLong', async () => {
    const outcome = await createArticleAndAddToList(
      maListe,
      { name: 'a'.repeat(61), categoryId: epicerie },
      null,
    );

    expect(outcome).toEqual(err({ type: 'NameTooLong' }));
  });

  it('returns CategoryNotFound for an unknown category, creating nothing', async () => {
    const outcome = await createArticleAndAddToList(
      maListe,
      { name: 'Houmous', categoryId: 'c-unknown' as CategoryId },
      null,
    );

    expect(outcome).toEqual(err({ type: 'CategoryNotFound' }));
    expect(await articles()).toHaveLength(3);
    expect(await items()).toEqual([]);
  });
});
