import { normalizedName, validateName } from '../../domain/name';
import { ok } from '../../domain/result';
import { seed } from './seed';

describe('the French first launch seed', () => {
  it('FR-020 lists the default categories in the order of the spec Assumptions', () => {
    expect(seed.categoryNames).toEqual([
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
    ]);
  });

  it('FR-023 names the first list "Ma liste"', () => {
    expect(seed.firstListName).toBe('Ma liste');
  });

  it('FR-022 holds only names that are already clean, since initializeStore stores them as given', () => {
    for (const name of [...seed.categoryNames, seed.firstListName]) {
      expect(validateName(name)).toEqual(ok(name));
    }
  });

  it('FR-021 holds no two category names that read the same', () => {
    const normalized = seed.categoryNames.map(normalizedName);

    expect(new Set(normalized).size).toBe(normalized.length);
  });
});
