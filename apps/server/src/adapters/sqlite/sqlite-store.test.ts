import { storeContracts } from '../../application/testing/contracts';
import { openDatabase } from './open-database';
import { SqliteStore } from './sqlite-store';

describe('SQLite store', () => {
  storeContracts(async () => new SqliteStore(openDatabase(':memory:')));
});
