import type { ArticleId } from '../../../domain/article';
import type { CategoryId } from '../../../domain/category';
import type { ListId } from '../../../domain/shopping-list';
import { seed } from '../seed';
import type { Fixture } from './story-store';

/** An article name at the 60 code point limit, to check that rows wrap it. */
export const LONG_ARTICLE_NAME =
  'Yaourt à la grecque nature au lait entier de brebis bio x 12';

const categories = seed.categoryNames.map((name, position) => ({
  id: `category-${position}` as CategoryId,
  name,
  position,
}));

const categoryId = (name: string): CategoryId => {
  const found = categories.find((category) => category.name === name);
  if (!found) throw new Error(`No default category ${name}`);
  return found.id;
};

const article = (id: string, name: string, category: string) => ({
  id: `article-${id}` as ArticleId,
  name,
  categoryId: categoryId(category),
});

const maListe = 'list-ma-liste' as ListId;
const barbecue = 'list-barbecue' as ListId;

const articles = [
  article('lait', 'Lait', 'Crèmerie'),
  article('pommes', 'Pommes', 'Fruits et légumes'),
  article('farine', 'Farine', 'Épicerie salée'),
  article('beurre', 'Beurre', 'Crèmerie'),
  article('yaourt', LONG_ARTICLE_NAME, 'Crèmerie'),
];

const articleId = (name: string): ArticleId => {
  const found = articles.find((candidate) => candidate.name === name);
  if (!found) throw new Error(`No fixture article ${name}`);
  return found.id;
};

/**
 * The French data stories and screen tests share: the default categories, "Ma liste" (current)
 * holding ticked and unticked items with and without a quantity, an empty "Barbecue", and
 * "Beurre" in the catalog only.
 */
export const fixture: Fixture = {
  categories,
  articles,
  lists: [
    { id: maListe, name: 'Ma liste' },
    { id: barbecue, name: 'Barbecue' },
  ],
  items: [
    {
      listId: maListe,
      articleId: articleId('Lait'),
      inCart: false,
      quantity: { amount: 2, unit: 'L' },
    },
    {
      listId: maListe,
      articleId: articleId('Pommes'),
      inCart: true,
      quantity: null,
    },
    {
      listId: maListe,
      articleId: articleId('Farine'),
      inCart: false,
      quantity: { amount: 1.5, unit: 'kg' },
    },
    {
      listId: maListe,
      articleId: articleId(LONG_ARTICLE_NAME),
      inCart: false,
      quantity: null,
    },
  ],
  currentListId: maListe,
};
