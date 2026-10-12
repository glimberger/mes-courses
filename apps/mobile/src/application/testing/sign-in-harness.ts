import { ok } from '../../domain/result';
import type { SyncServer } from '../ports/sync-server';
import { InMemoryAccountServer } from './in-memory-account-server';
import { InMemoryCredentialStore } from './in-memory-credential-store';
import { inMemoryLocalDataEraser } from './in-memory-local-data-eraser';
import {
  InMemoryRepositories,
  InMemoryUnitOfWork,
} from './in-memory-repositories';
import { SequentialIdGenerator } from './sequential-id-generator';

/** A device with fakes for every port the sign-in use cases use (use case tests). */
const seed = { categoryNames: ['Fruits'], firstListName: 'Courses' };
const health = { serverId: 'server-1', apiVersion: 1, minAppVersion: '1.1.0' };

export const signInHarness = async () => {
  const repositories = new InMemoryRepositories();
  const unitOfWork = new InMemoryUnitOfWork(repositories);
  const credentials = new InMemoryCredentialStore();
  const accountServer = new InMemoryAccountServer();
  const ids = new SequentialIdGenerator();
  const localDataEraser = inMemoryLocalDataEraser({
    repositories,
    unitOfWork,
    ids,
    seed,
  });
  let healthResult: Awaited<ReturnType<SyncServer['health']>> = ok(health);
  const calls: string[] = [];
  const syncServer = {
    health: async (url: string) => {
      calls.push(`health ${url}`);
      return healthResult;
    },
  } as SyncServer;
  const deps = {
    unitOfWork,
    credentials,
    localDataEraser,
    syncServer,
    accountServer,
  };
  const syncState = () => unitOfWork.run((repos) => repos.syncState.get());
  const lists = () => unitOfWork.run((repos) => repos.lists.count());
  const setSyncState = (patch: Parameters<typeof Object.assign>[1]) =>
    unitOfWork.run(async (repos) =>
      repos.syncState.save({ ...(await repos.syncState.get()), ...patch }),
    );
  return {
    deps,
    calls,
    credentials,
    accountServer,
    syncState,
    lists,
    setSyncState,
    setHealth: (result: typeof healthResult) => {
      healthResult = result;
    },
    unitOfWork,
  };
};
