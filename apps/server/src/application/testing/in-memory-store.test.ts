import { storeContracts } from './contracts';
import { InMemoryStore } from './in-memory-store';

describe('in-memory fakes', () => {
  storeContracts(async () => new InMemoryStore());
});
