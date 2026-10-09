import type { ServerStore } from '../../ports/store';
import { appliedChangeRepositoryContract } from './applied-change-repository.contract';
import { articleRepositoryContract } from './article-repository.contract';
import { categoryRepositoryContract } from './category-repository.contract';
import { deviceRepositoryContract } from './device-repository.contract';
import { listItemRepositoryContract } from './list-item-repository.contract';
import { listRepositoryContract } from './list-repository.contract';
import { metaRepositoryContract } from './meta-repository.contract';
import { pairingCodeRepositoryContract } from './pairing-code-repository.contract';
import { pairingFailureRepositoryContract } from './pairing-failure-repository.contract';
import { serverStoreContract } from './server-store.contract';

/** Every repository suite, run against one kind of store (the fakes, then SQLite). */
export const storeContracts = (createStore: () => Promise<ServerStore>) => {
  serverStoreContract(createStore);
  metaRepositoryContract(createStore);
  categoryRepositoryContract(createStore);
  articleRepositoryContract(createStore);
  listRepositoryContract(createStore);
  listItemRepositoryContract(createStore);
  appliedChangeRepositoryContract(createStore);
  deviceRepositoryContract(createStore);
  pairingCodeRepositoryContract(createStore);
  pairingFailureRepositoryContract(createStore);
};
