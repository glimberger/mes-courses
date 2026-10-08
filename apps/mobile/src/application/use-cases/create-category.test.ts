import type { CategoryId } from '../../domain/category';
import { err, ok } from '../../domain/result';
import type { UnitOfWork } from '../ports/unit-of-work';
import {
  InMemoryRepositories,
  InMemoryUnitOfWork,
} from '../testing/in-memory-repositories';
import { SequentialIdGenerator } from '../testing/sequential-id-generator';
import { createCreateCategory } from './create-category';
import { createGetCategories } from './get-categories';

const fruits = {
  id: 'c-0' as CategoryId,
  name: 'Fruits et légumes',
  position: 0,
};
const boissons = { id: 'c-1' as CategoryId, name: 'Boissons', position: 4 };

describe('createCategory', () => {
  let unitOfWork: UnitOfWork;
  let createCategory: ReturnType<typeof createCreateCategory>;
  const categories = () => unitOfWork.run((repos) => repos.categories.all());

  beforeEach(async () => {
    unitOfWork = new InMemoryUnitOfWork(new InMemoryRepositories());
    createCategory = createCreateCategory({
      unitOfWork,
      ids: new SequentialIdGenerator(),
    });
    await unitOfWork.run(async (repos) => {
      await repos.categories.add(fruits);
      await repos.categories.add(boissons);
    });
  });

  it('US4-2 FR-019 appends the category after the existing ones and getCategories lists it last', async () => {
    const outcome = await createCategory('Bébé');

    expect(outcome).toEqual(ok({ categoryId: 'id-1' }));
    expect(await categories()).toContainEqual({
      id: 'id-1',
      name: 'Bébé',
      position: 5,
    });
    expect(await createGetCategories({ unitOfWork })()).toEqual([
      { id: 'c-0', name: 'Fruits et légumes' },
      { id: 'c-1', name: 'Boissons' },
      { id: 'id-1', name: 'Bébé' },
    ]);
  });

  it('FR-022 stores the name cleaned: "  Produits   bébé " is created as "Produits bébé"', async () => {
    await createCategory('  Produits   bébé ');

    expect((await categories()).map((category) => category.name)).toContain(
      'Produits bébé',
    );
  });

  it('US4-3 FR-021 refuses "boissons" with NameAlreadyUsed carrying the existing category, creating nothing', async () => {
    const outcome = await createCategory('boissons');

    expect(outcome).toEqual(
      err({ type: 'NameAlreadyUsed', existing: boissons }),
    );
    expect(await categories()).toHaveLength(2);
  });

  it('US4-4 refuses a blank name with NameRequired, creating nothing', async () => {
    const outcome = await createCategory('   ');

    expect(outcome).toEqual(err({ type: 'NameRequired' }));
    expect(await categories()).toHaveLength(2);
  });

  it('FR-022 refuses a name of 61 characters with NameTooLong', async () => {
    const outcome = await createCategory('a'.repeat(61));

    expect(outcome).toEqual(err({ type: 'NameTooLong' }));
    expect(await categories()).toHaveLength(2);
  });
});
