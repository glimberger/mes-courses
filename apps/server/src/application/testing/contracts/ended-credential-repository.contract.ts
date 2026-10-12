import type { ServerStore } from '../../ports/store';

export const endedCredentialRepositoryContract = (
  createStore: () => Promise<ServerStore>,
) => {
  describe('EndedCredentialRepository contract', () => {
    let store: ServerStore;

    beforeEach(async () => {
      store = await createStore();
    });

    it('finds nothing for an unknown hash', async () => {
      expect(
        await store.run(({ endedCredentials }) => endedCredentials.find('h-1')),
      ).toBeNull();
    });

    it('remembers why a credential ended', async () => {
      await store.run(({ endedCredentials }) =>
        endedCredentials.add(
          'h-1',
          'accountDeleted',
          '2026-10-05T10:00:00.000Z',
        ),
      );

      await store.run(async ({ endedCredentials }) => {
        expect(await endedCredentials.find('h-1')).toEqual({
          reason: 'accountDeleted',
        });
        expect(await endedCredentials.find('h-2')).toBeNull();
      });
    });

    it('rejects the same hash twice', async () => {
      await store.run(({ endedCredentials }) =>
        endedCredentials.add(
          'h-1',
          'accountDeleted',
          '2026-10-05T10:00:00.000Z',
        ),
      );

      await expect(
        store.run(({ endedCredentials }) =>
          endedCredentials.add(
            'h-1',
            'accountDeleted',
            '2026-10-06T10:00:00.000Z',
          ),
        ),
      ).rejects.toThrow();
    });
  });
};
