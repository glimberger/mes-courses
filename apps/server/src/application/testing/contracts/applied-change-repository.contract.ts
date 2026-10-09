import type { ServerStore } from '../../ports/store';
import { appliedChange } from './entities';

export const appliedChangeRepositoryContract = (
  createStore: () => Promise<ServerStore>,
) => {
  describe('AppliedChangeRepository contract', () => {
    let store: ServerStore;

    beforeEach(async () => {
      store = await createStore();
    });

    it('has only the changes it was given', async () => {
      await store.run(async ({ appliedChanges }) => {
        expect(await appliedChanges.has('ch-1')).toBe(false);
        await appliedChanges.add(appliedChange('ch-1'));
        expect(await appliedChanges.has('ch-1')).toBe(true);
        expect(await appliedChanges.has('ch-2')).toBe(false);
      });
    });

    it('keeps the changes across runs', async () => {
      await store.run(({ appliedChanges }) =>
        appliedChanges.add(appliedChange('ch-1')),
      );

      expect(
        await store.run(({ appliedChanges }) => appliedChanges.has('ch-1')),
      ).toBe(true);
    });
  });
};
