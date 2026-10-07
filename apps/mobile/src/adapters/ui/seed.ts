import type { Seed } from '../../application/use-cases/initialize-store';

/**
 * The first launch's French content (FR-020, FR-023, research R18). `initializeStore` stores
 * these names as given, so each one is already clean and no two read the same.
 */
export const seed: Seed = {
  categoryNames: [
    'Fruits et légumes',
    'Boucherie et poissonnerie',
    'Crèmerie',
    'Boulangerie',
    'Épicerie salée',
    'Épicerie sucrée',
    'Surgelés',
    'Boissons',
    'Hygiène et beauté',
    'Entretien',
    'Divers',
  ],
  firstListName: 'Ma liste',
};
