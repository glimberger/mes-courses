import {
  MAX_NAME_LENGTH,
  nameLength,
  validateName,
} from '../../../domain/name';
import { ok } from '../../../domain/result';
import { seed } from '../seed';
import { fixture, LONG_ARTICLE_NAME } from './fixtures';
import { buildStoryStore } from './story-store';

describe('the shared French fixtures', () => {
  it('hold an article name exactly at the 60 code point limit', () => {
    expect(nameLength(LONG_ARTICLE_NAME)).toBe(MAX_NAME_LENGTH);
    expect(validateName(LONG_ARTICLE_NAME)).toEqual(ok(LONG_ARTICLE_NAME));
  });

  it('hold the default categories in their order', () => {
    expect(fixture.categories.map((category) => category.name)).toEqual(
      seed.categoryNames,
    );
  });

  it('are accepted by the fakes, which reject what the SQLite schema rejects', async () => {
    const { unitOfWork } = await buildStoryStore({ seed: fixture });

    expect(await unitOfWork.run((repos) => repos.lists.all())).toEqual([
      { id: expect.any(String), name: 'Ma liste' },
      { id: expect.any(String), name: 'Barbecue' },
    ]);
  });
});
