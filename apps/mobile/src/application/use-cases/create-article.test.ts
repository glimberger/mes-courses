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
import { createCreateArticle } from './create-article';

const maListe = 'l-1' as ListId;
const epicerie = 'c-1' as CategoryId;
const cremerie = 'c-2' as CategoryId;
const beurre = { id: 'a-1' as ArticleId, name: 'Beurre', categoryId: cremerie };
const oeufs = { id: 'a-2' as ArticleId, name: 'Œufs', categoryId: cremerie };

describe('createArticle', () => {
  let unitOfWork: UnitOfWork;
  let createArticle: ReturnType<typeof createCreateArticle>;
  const articles = () => unitOfWork.run((repos) => repos.articles.all());
  const items = () => unitOfWork.run((repos) => repos.items.forList(maListe));
  const pending = () => unitOfWork.run((repos) => repos.changes.pending(100));

  beforeEach(async () => {
    unitOfWork = new InMemoryUnitOfWork(new InMemoryRepositories());
    createArticle = createCreateArticle({
      unitOfWork,
      ids: new SequentialIdGenerator(),
    });
    await unitOfWork.run(async (repos) => {
      await repos.categories.add({
        id: epicerie,
        name: 'Épicerie',
        position: 0,
      });
      await repos.categories.add({
        id: cremerie,
        name: 'Crèmerie',
        position: 1,
      });
      await repos.articles.add(beurre);
      await repos.articles.add(oeufs);
      await repos.lists.add({ id: maListe, name: 'Ma liste' });
      await repos.appState.setCurrentListId(maListe);
    });
  });

  it('US5 creates the article in its category and puts it on no list', async () => {
    const outcome = await createArticle({
      name: 'Houmous',
      categoryId: epicerie,
    });

    expect(outcome).toEqual(ok({ articleId: 'id-1' }));
    expect(await articles()).toContainEqual({
      id: 'id-1',
      name: 'Houmous',
      categoryId: epicerie,
    });
    expect(await items()).toEqual([]);
  });

  it('FR-022 stores the name cleaned', async () => {
    await createArticle({ name: '  Houmous   maison ', categoryId: epicerie });

    expect((await articles()).map((article) => article.name)).toContain(
      'Houmous maison',
    );
  });

  it('records the article change only, no list item', async () => {
    await createArticle({ name: 'Yaourt', categoryId: cremerie });

    expect(
      (await pending()).map(({ kind, id, fields }) => ({ kind, id, fields })),
    ).toEqual([
      {
        kind: 'article',
        id: 'id-1',
        fields: { name: 'Yaourt', categoryId: cremerie },
      },
    ]);
  });

  it.each([
    [' beurre ', beurre],
    ['Oeufs', oeufs],
  ])(
    'FR-021 refuses "%s" with NameAlreadyUsed carrying the existing article, creating nothing',
    async (name, existing) => {
      const outcome = await createArticle({ name, categoryId: epicerie });

      expect(outcome).toEqual(err({ type: 'NameAlreadyUsed', existing }));
      expect(await articles()).toHaveLength(2);
      expect(await pending()).toEqual([]);
    },
  );

  it('refuses a blank name with NameRequired', async () => {
    expect(await createArticle({ name: '   ', categoryId: epicerie })).toEqual(
      err({ type: 'NameRequired' }),
    );
  });

  it('refuses a name of 61 characters with NameTooLong', async () => {
    expect(
      await createArticle({ name: 'a'.repeat(61), categoryId: epicerie }),
    ).toEqual(err({ type: 'NameTooLong' }));
  });

  it('returns CategoryNotFound for an unknown category, creating nothing', async () => {
    const outcome = await createArticle({
      name: 'Houmous',
      categoryId: 'c-unknown' as CategoryId,
    });

    expect(outcome).toEqual(err({ type: 'CategoryNotFound' }));
    expect(await articles()).toHaveLength(2);
  });
});
