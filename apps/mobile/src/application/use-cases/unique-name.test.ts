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
});
