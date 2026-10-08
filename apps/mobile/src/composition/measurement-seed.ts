import type { ArticleId } from '../domain/article';
import type { CategoryId } from '../domain/category';
import type { Quantity } from '../domain/quantity';
import type { Result } from '../domain/result';
import type { ListId } from '../domain/shopping-list';
import type { UseCases } from '../adapters/ui/use-cases';

/**
 * 100 common French products, by default category (research R11, spec Assumptions). Quickstart
 * step 15 searches "Pommes", "Lait demi-écrémé" and "Farine de blé".
 */
const PRODUCTS: Record<string, string[]> = {
  'Fruits et légumes': [
    'Pommes',
    'Poires',
    'Bananes',
    'Oranges',
    'Citrons',
    'Fraises',
    'Raisin',
    'Tomates',
    'Carottes',
    'Pommes de terre',
    'Courgettes',
    'Salade verte',
    'Oignons',
    'Ail',
  ],
  'Boucherie et poissonnerie': [
    'Poulet',
    'Steak haché',
    'Jambon blanc',
    'Saucisses',
    'Côtelettes de porc',
    'Saumon',
    'Cabillaud',
    'Crevettes',
    'Lardons',
  ],
  Crèmerie: [
    'Lait demi-écrémé',
    'Beurre',
    'Œufs',
    'Yaourt nature',
    'Crème fraîche',
    'Emmental râpé',
    'Comté',
    'Camembert',
    'Fromage blanc',
    'Mozzarella',
    'Lait entier',
    'Petits suisses',
  ],
  Boulangerie: [
    'Baguette',
    'Pain de mie',
    'Croissants',
    'Pain complet',
    'Brioche',
    'Biscottes',
  ],
  'Épicerie salée': [
    'Farine de blé',
    'Pâtes',
    'Riz',
    'Lentilles',
    'Pois chiches',
    "Huile d'olive",
    'Vinaigre',
    'Sel',
    'Poivre',
    'Moutarde',
    'Sauce tomate',
    'Thon en boîte',
    'Haricots verts en conserve',
    'Bouillon de légumes',
  ],
  'Épicerie sucrée': [
    'Sucre',
    'Chocolat noir',
    'Confiture de fraises',
    'Miel',
    'Céréales',
    'Biscuits',
    'Compote',
    'Café moulu',
    'Thé vert',
    'Pâte à tartiner',
  ],
  Surgelés: [
    'Petits pois surgelés',
    'Épinards hachés',
    'Frites',
    'Pizza',
    'Glace vanille',
    'Poisson pané',
    'Haricots verts surgelés',
  ],
  Boissons: [
    'Eau minérale',
    'Eau gazeuse',
    "Jus d'orange",
    'Limonade',
    'Bière',
    'Vin rouge',
    'Sirop de menthe',
    "Lait d'amande",
  ],
  'Hygiène et beauté': [
    'Dentifrice',
    'Shampooing',
    'Gel douche',
    'Savon',
    'Déodorant',
    'Coton-tiges',
    'Mouchoirs',
    'Papier toilette',
  ],
  Entretien: [
    'Liquide vaisselle',
    'Lessive',
    'Éponges',
    'Sacs poubelle',
    'Essuie-tout',
    'Nettoyant multi-usage',
    'Pastilles lave-vaisselle',
  ],
  Divers: ['Piles', 'Ampoules', 'Bougies', 'Allumettes', 'Sacs congélation'],
};

const VARIANTS = 10;
const LIST_COUNT = 20;
const ITEMS_PER_OTHER_LIST = 50;
/** The longest name FR-022 accepts, in code points. */
const MAX_NAME_LENGTH = 60;

/** Descriptive words by their length in code points, to lengthen a name word by word. */
const WORDS_BY_LENGTH: Record<number, string> = {
  2: 'XL',
  3: 'bio',
  4: 'doux',
  5: 'frais',
  6: 'nature',
  7: 'premium',
  8: 'gourmand',
  9: 'française',
  10: 'délicieuse',
  11: 'authentique',
  12: 'traditionnel',
  13: 'sélectionnées',
};

const length = (text: string) => [...text].length;

/** The name made exactly 60 code points long by appending whole words, never cut. */
const lengthened = (name: string): string => {
  let result = name;
  // Each word costs a space; the last one fills the gap left exactly.
  while (MAX_NAME_LENGTH - length(result) > 14) {
    result += ` ${WORDS_BY_LENGTH[Math.min(12, MAX_NAME_LENGTH - length(result) - 4)]}`;
  }
  const last = WORDS_BY_LENGTH[MAX_NAME_LENGTH - length(result) - 1];
  if (last === undefined) throw new Error(`Cannot lengthen "${name}"`);
  return `${result} ${last}`;
};

type SeedArticle = { name: string; category: string };

/**
 * The 1 000 articles, products interleaved so any run of them spreads over the categories:
 * article k is variant floor(k / 100) + 1 of product k % 100. Variant 1 is the plain name,
 * variant v "<name> v"; one variant of each product, from 2 to 10, is lengthened to 60 code
 * points, so about one name in ten is at the limit wherever the run starts.
 */
const ARTICLES: SeedArticle[] = (() => {
  const products = Object.entries(PRODUCTS).flatMap(([category, names]) =>
    names.map((name) => ({ name, category })),
  );
  return Array.from({ length: products.length * VARIANTS }, (_, k) => {
    const product = k % products.length;
    const { name, category } = products[product] as SeedArticle;
    const variant = Math.floor(k / products.length) + 1;
    const numbered = variant === 1 ? name : `${name} ${variant}`;
    const long = variant === (product % (VARIANTS - 1)) + 2;
    return { name: long ? lengthened(numbered) : numbered, category };
  });
})();

/** The value of a use case that must succeed: the seed builds valid data only. */
const valueOf = <T>(outcome: Result<T, { type: string }>): T => {
  if (!outcome.ok) {
    throw new Error(`Measurement seed refused: ${outcome.error.type}`);
  }
  return outcome.value;
};

/** "2 kg" on every other pair of items of the current list, so both kinds sit side by side. */
const quantityOf = (item: number): Quantity | null =>
  Math.floor(item / 2) % 2 === 1 ? { amount: 2, unit: 'kg' } : null;

/**
 * Fills a store holding no article to the spec's data size, shaped like real use (research R11,
 * spec Assumptions), through the use cases: 1 000 articles, 20 lists, `itemCount` items on the
 * current list (at most 1 000; item i ticked when i is odd, with "2 kg" when floor(i / 2) is
 * odd), and 50 unticked items with no quantity on each other list. `value` is the build-time
 * `EXPO_PUBLIC_SEED_ITEMS`: anything but a positive whole number is ignored, and so is a store
 * that already holds an article. With 200 items it runs about 1 300 writes, for measurement
 * builds only: the release guard refuses it in a `production` build.
 */
export const seedForMeasurement = async (
  useCases: UseCases,
  value: string | undefined,
): Promise<void> => {
  if (value === undefined || !/^[1-9]\d*$/.test(value)) return;
  const itemCount = Math.min(Number(value), ARTICLES.length);

  const current = (await useCases.getCurrentList()).list.id;
  const catalog = await useCases.getCatalog(current);
  if (catalog.sections.some((section) => section.articles.length > 0)) return;

  const categories = new Map(
    (await useCases.getCategories()).map(
      (category) => [category.name, category.id] as const,
    ),
  );
  const categoryOf = (name: string): CategoryId => {
    const id = categories.get(name);
    if (id === undefined) throw new Error(`No category "${name}"`);
    return id;
  };

  const created = new Map<number, ArticleId>();
  /** Puts article k on the list, creating it the first time. */
  const place = async (
    listId: ListId,
    k: number,
    quantity: Quantity | null,
  ): Promise<ArticleId> => {
    const existing = created.get(k);
    if (existing !== undefined) {
      valueOf(await useCases.addArticleToList(listId, existing, quantity));
      return existing;
    }
    const { name, category } = ARTICLES[k] as SeedArticle;
    const { articleId } = valueOf(
      await useCases.createArticleAndAddToList(
        listId,
        { name, categoryId: categoryOf(category) },
        quantity,
      ),
    );
    created.set(k, articleId);
    return articleId;
  };

  for (let item = 0; item < itemCount; item += 1) {
    const articleId = await place(current, item, quantityOf(item));
    if (item % 2 === 1) {
      valueOf(await useCases.toggleItemInCart(current, articleId));
    }
  }

  // The other lists take the articles that follow the current list's, around the catalog.
  for (let list = 2; list <= LIST_COUNT; list += 1) {
    const { listId } = valueOf(await useCases.createList(`Liste ${list}`));
    const first = itemCount + (list - 2) * ITEMS_PER_OTHER_LIST;
    for (let at = 0; at < ITEMS_PER_OTHER_LIST; at += 1) {
      await place(listId, (first + at) % ARTICLES.length, null);
    }
  }

  // With few items, some articles are on no list yet: each is created on the current list, then
  // taken off it, so the catalog is whole.
  for (let k = 0; k < ARTICLES.length; k += 1) {
    if (created.has(k)) continue;
    const articleId = await place(current, k, null);
    valueOf(await useCases.removeItemFromList(current, articleId));
  }
};
