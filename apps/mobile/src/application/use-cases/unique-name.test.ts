import { err, ok } from '../../domain/result';
import { uniqueName } from './unique-name';

const named = (names: string[]) => ({
  findByNormalizedName: (normalized: string) =>
    Promise.resolve(
      names
        .map((name) => ({ name }))
        .find(({ name }) => name.toLowerCase() === normalized) ?? null,
    ),
});

describe('uniqueName', () => {
  it('FR-022 returns the cleaned name when no entity has it', async () => {
    expect(await uniqueName(named(['Boissons']), '  Bébé  ')).toEqual(
      ok('Bébé'),
    );
  });

  it('FR-021 returns NameAlreadyUsed carrying the entity that has the name, whatever the case', async () => {
    expect(await uniqueName(named(['Boissons']), 'boissons')).toEqual(
      err({ type: 'NameAlreadyUsed', existing: { name: 'Boissons' } }),
    );
  });

  it('refuses a blank name with NameRequired, without reading the repository', async () => {
    const repository = { findByNormalizedName: jest.fn() };

    expect(await uniqueName(repository, '   ')).toEqual(
      err({ type: 'NameRequired' }),
    );
    expect(repository.findByNormalizedName).not.toHaveBeenCalled();
  });

  it('FR-022 refuses a name of 61 characters with NameTooLong', async () => {
    expect(await uniqueName(named([]), 'a'.repeat(61))).toEqual(
      err({ type: 'NameTooLong' }),
    );
  });

  describe('when an entity may keep its own name (002 US1)', () => {
    const lait = { id: 'a-1', name: 'Lait' };
    const beurre = { id: 'a-2', name: 'Beurre' };
    const articles = {
      findByNormalizedName: (normalized: string) =>
        Promise.resolve(
          [lait, beurre].find(
            ({ name }) =>
              name.toLowerCase().replace(/\s+/g, ' ') === normalized,
          ) ?? null,
        ),
    };
    const isLait = (existing: { id: string }) => existing.id === lait.id;

    it('US1-4 refuses " beurre " for Lait, carrying the other article', async () => {
      expect(await uniqueName(articles, ' beurre ', isLait)).toEqual(
        err({ type: 'NameAlreadyUsed', existing: beurre }),
      );
    });

    it('US1-5 accepts the own name in another case: "Lait" to "lait"', async () => {
      expect(await uniqueName(articles, 'lait', isLait)).toEqual(ok('lait'));
    });

    it('US1-5 accepts the own name with other spaces, cleaned', async () => {
      const pommes = { id: 'a-3', name: 'Pommes de terre' };
      const repository = {
        findByNormalizedName: () => Promise.resolve(pommes),
      };

      expect(
        await uniqueName(
          repository,
          'Pommes  de terre',
          (existing) => existing.id === pommes.id,
        ),
      ).toEqual(ok('Pommes de terre'));
    });

    it('US1-6 still refuses a blank name and a name of 61 characters', async () => {
      expect(await uniqueName(articles, '   ', isLait)).toEqual(
        err({ type: 'NameRequired' }),
      );
      expect(await uniqueName(articles, 'a'.repeat(61), isLait)).toEqual(
        err({ type: 'NameTooLong' }),
      );
    });
  });
});
