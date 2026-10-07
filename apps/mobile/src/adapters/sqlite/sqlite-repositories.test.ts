/** @jest-environment node */
import { appStateRepositoryContract } from '../../application/testing/contracts/app-state-repository.contract';
import { articleRepositoryContract } from '../../application/testing/contracts/article-repository.contract';
import { categoryRepositoryContract } from '../../application/testing/contracts/category-repository.contract';
import {
  article,
  articleId,
  category,
  list,
} from '../../application/testing/contracts/entities';
import { listItemRepositoryContract } from '../../application/testing/contracts/list-item-repository.contract';
import { shoppingListRepositoryContract } from '../../application/testing/contracts/shopping-list-repository.contract';
import { unitOfWorkContract } from '../../application/testing/contracts/unit-of-work.contract';
import { StorageFull } from '../../application/ports/storage-full';
import { NodeSqlDatabase } from '../../../test/sqlite/node-sql-database';
import { migrate } from './migrations';
import type { SqlDatabase } from './sql-database';
import { StorageError } from './storage-error';
import { SqliteUnitOfWork, sqliteRepositories } from './unit-of-work';

const failingDatabase = (error: unknown): SqlDatabase => ({
  execAsync: () => Promise.reject(error),
  runAsync: () => Promise.reject(error),
  getAllAsync: () => Promise.reject(error),
  getFirstAsync: () => Promise.reject(error),
  withTransactionAsync: () => Promise.reject(error),
});

/** What a rejection gives, to inspect it. */
const rejectionOf = async (promise: Promise<unknown>): Promise<Error> => {
  try {
    await promise;
  } catch (error) {
    return error as Error;
  }
  throw new Error('Expected a rejection');
};

describe('SQLite repositories', () => {
  const opened: NodeSqlDatabase[] = [];

  const migratedDatabase = async () => {
    const db = new NodeSqlDatabase();
    opened.push(db);
    await migrate(db);
    return db;
  };

  afterEach(() => {
    for (const db of opened.splice(0)) db.close();
  });

  const createRepositories = async () =>
    sqliteRepositories(await migratedDatabase());

  categoryRepositoryContract(createRepositories);
  articleRepositoryContract(createRepositories);
  shoppingListRepositoryContract(createRepositories);
  listItemRepositoryContract(createRepositories);
  appStateRepositoryContract(createRepositories);
  unitOfWorkContract(
    async () => new SqliteUnitOfWork(await migratedDatabase()),
  );

  describe('FR-030 a full storage', () => {
    it.each([
      [
        'the SQLite result code 13',
        Object.assign(new Error('Houmous maison'), { errcode: 13 }),
      ],
      [
        'the result code 13 in the expo-sqlite message',
        new Error('Error code 13: Houmous maison'),
      ],
      [
        'the message "database or disk is full"',
        new Error(
          "Call to function 'NativeStatement.runAsync' has been rejected.\n→ Caused by: database or disk is full",
        ),
      ],
    ])(
      'rejects with StorageFull for %s, keeping no other text',
      async (_, error) => {
        const repos = sqliteRepositories(failingDatabase(error));

        const rejection = await rejectionOf(
          repos.articles.add(article('a-1', 'Houmous maison', 'c-1')),
        );

        expect(rejection).toBeInstanceOf(StorageFull);
        expect(rejection.message).toBe('Storage operation failed');
        expect(rejection.stack).not.toContain('Houmous');
        expect({ ...rejection }).toStrictEqual({ name: 'StorageFull' });
        expect('cause' in rejection).toBe(false);
      },
    );

    it('rejects a run with StorageFull when the transaction cannot start', async () => {
      const unitOfWork = new SqliteUnitOfWork(
        failingDatabase(new Error('database or disk is full')),
      );

      await expect(
        unitOfWork.run(async () => undefined),
      ).rejects.toBeInstanceOf(StorageFull);
    });
  });

  describe('FR-030 a storage failure keeps no stored value', () => {
    it('rejects a write refused by a constraint with a StorageError carrying only the result code', async () => {
      const db = await migratedDatabase();
      const repos = sqliteRepositories(db);
      await repos.categories.add(category('c-1', 'Épicerie salée', 0));
      await db.runAsync(
        `INSERT INTO article (id, name, normalized_name, category_id) VALUES ('a-0', 'Houmous', 'houmous maison', 'c-1')`,
        [],
      );

      const rejection = await rejectionOf(
        repos.articles.add(article('a-1', 'Houmous maison', 'c-1')),
      );

      expect(rejection).toBeInstanceOf(StorageError);
      expect(rejection.message).toBe('Storage operation failed');
      expect(rejection.stack).not.toContain('Houmous');
      expect(rejection.stack).not.toContain('INSERT');
      expect({ ...rejection }).toStrictEqual({
        name: 'StorageError',
        code: 19,
      });
      expect('cause' in rejection).toBe(false);
    });

    it('rejects a run on a closed database with a StorageError', async () => {
      const db = await migratedDatabase();
      const unitOfWork = new SqliteUnitOfWork(db);
      db.close();
      opened.splice(opened.indexOf(db), 1);

      const rejection = await rejectionOf(
        unitOfWork.run(async () => undefined),
      );

      expect(rejection).toBeInstanceOf(StorageError);
      expect(rejection.message).toBe('Storage operation failed');
      expect({ ...rejection }).toStrictEqual({ name: 'StorageError' });
      expect('cause' in rejection).toBe(false);
    });

    it('rethrows the error of a run that throws unchanged', async () => {
      const unitOfWork = new SqliteUnitOfWork(await migratedDatabase());
      const failure = new Error('failed in the use case');

      await expect(
        unitOfWork.run(async () => {
          throw failure;
        }),
      ).rejects.toBe(failure);
    });
  });

  it('R25 binds every value as a parameter: a name made of SQL is saved and read back unchanged', async () => {
    const db = await migratedDatabase();
    const repos = sqliteRepositories(db);
    const name = "'); DROP TABLE article; --";
    await repos.categories.add(category('c-1', 'Divers', 0));
    await repos.lists.add(list('l-1', name));

    await repos.articles.add(article('a-1', name, 'c-1'));

    expect(await repos.articles.findById(articleId('a-1'))).toEqual(
      article('a-1', name, 'c-1'),
    );
    expect(
      await db.getFirstAsync(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'article'`,
        [],
      ),
    ).toEqual({ name: 'article' });
  });
});
