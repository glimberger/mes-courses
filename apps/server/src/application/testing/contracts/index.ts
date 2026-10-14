import type { ServerStore } from '../../ports/store';
import { accountRepositoryContract } from './account-repository.contract';
import { appliedChangeRepositoryContract } from './applied-change-repository.contract';
import {
  articleInCategoryContract,
  articleRepositoryContract,
} from './article-repository.contract';
import { categoryRepositoryContract } from './category-repository.contract';
import { authAttemptRepositoryContract } from './auth-attempt-repository.contract';
import { deviceRepositoryContract } from './device-repository.contract';
import { endedCredentialRepositoryContract } from './ended-credential-repository.contract';
import { isolationContract } from './isolation.contract';
import { listItemRepositoryContract } from './list-item-repository.contract';
import { listRepositoryContract } from './list-repository.contract';
import { metaRepositoryContract } from './meta-repository.contract';
import { scopedTo } from './scoped-store';
import { serverStoreContract } from './server-store.contract';

/**
 * Every repository suite, run against one kind of store (the fakes, then SQLite). 003's suites run
 * in a default account; 004's are about the accounts themselves.
 */
export const storeContracts = (createStore: () => Promise<ServerStore>) => {
  const inDefaultAccount = async () => scopedTo(await createStore());

  serverStoreContract(createStore);
  metaRepositoryContract(inDefaultAccount);
  categoryRepositoryContract(inDefaultAccount);
  articleRepositoryContract(inDefaultAccount);
  articleInCategoryContract(inDefaultAccount);
  listRepositoryContract(inDefaultAccount);
  listItemRepositoryContract(inDefaultAccount);
  appliedChangeRepositoryContract(inDefaultAccount);
  deviceRepositoryContract(inDefaultAccount);

  accountRepositoryContract(createStore);
  endedCredentialRepositoryContract(createStore);
  authAttemptRepositoryContract(createStore);
  isolationContract(createStore);
};
