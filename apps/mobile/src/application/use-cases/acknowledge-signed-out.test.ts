import { InMemoryCredentialStore } from '../testing/in-memory-credential-store';
import {
  InMemoryRepositories,
  InMemoryUnitOfWork,
} from '../testing/in-memory-repositories';
import { eraserOf } from '../testing/in-memory-local-data-eraser';
import { SequentialIdGenerator } from '../testing/sequential-id-generator';
import type { ListId } from '../../domain/shopping-list';
import { createAcknowledgeSignedOut } from './acknowledge-signed-out';

describe('acknowledgeSignedOut', () => {
  it('004 US5-4 erases the replica and the credential and returns to notConnected', async () => {
    const ids = new SequentialIdGenerator();
    const unitOfWork = new InMemoryUnitOfWork(new InMemoryRepositories());
    const credentials = new InMemoryCredentialStore('secret');
    await unitOfWork.run(async (repos) => {
      await repos.lists.add({ id: 'l-1' as ListId, name: 'Locale' });
      await repos.changes.record('list', 'l-1', { name: 'Locale' });
      await repos.syncState.save({
        ...(await repos.syncState.get()),
        serverUrl: 'https://courses.example.fr',
        deviceId: 'device-1',
        accountId: 'account-1',
      });
    });
    const acknowledge = createAcknowledgeSignedOut({
      credentials,
      localDataEraser: eraserOf(unitOfWork, ids, {
        categoryNames: ['Fruits'],
        firstListName: 'Ma liste',
      }),
    });

    expect(await acknowledge()).toEqual({ ok: true, value: undefined });

    expect(await credentials.read()).toBeNull();
    const state = await unitOfWork.run((repos) => repos.syncState.get());
    expect(state.serverUrl).toBeNull();
    expect(state.accountId).toBeNull();
    // Only the seed of a first launch is waiting: nothing of the account's outbox.
    const pending = await unitOfWork.run((repos) => repos.changes.pending(100));
    expect(pending.map(({ id }) => id)).not.toContain('l-1');
    expect(
      (await unitOfWork.run((repos) => repos.lists.all())).map((l) => l.name),
    ).not.toContain('Locale');
  });
});
