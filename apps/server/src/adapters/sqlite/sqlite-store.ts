import { decodeHlc, encodeHlc, type Hlc } from '@mes-courses/sync-core';

import type { AccountRecord } from '../../domain/account';
import type {
  AppliedChangeRecord,
  ArticleRecord,
  ArticleRepository,
  CategoryRecord,
  DeviceRecord,
  EntityRecord,
  EntityRepository,
  ListItemRecord,
  ListRecord,
  DirectoryRepositories,
  Repositories,
  ServerStore,
} from '../../application/ports/store';
import { rollbackQuietly, type SqlDatabase } from './sql-database';

const hlcOrNull = (encoded: string | null): Hlc | null =>
  encoded === null ? null : decodeHlc(encoded);
const encodeOrNull = (hlc: Hlc | null): string | null =>
  hlc === null ? null : encodeHlc(hlc);

type StampedRow = {
  id: string;
  name: string;
  name_hlc: string;
  normalized_name: string;
  created_hlc: string;
  deleted_hlc: string | null;
  merged_into: string | null;
  seq: number;
};

type CategoryRow = StampedRow & { position: number; position_hlc: string };
type ArticleRow = StampedRow & { category_id: string; category_hlc: string };

const stamped = (row: StampedRow) => ({
  id: row.id,
  name: row.name,
  nameHlc: decodeHlc(row.name_hlc),
  normalizedName: row.normalized_name,
  createdHlc: decodeHlc(row.created_hlc),
  deletedHlc: hlcOrNull(row.deleted_hlc),
  mergedInto: row.merged_into,
  seq: row.seq,
});

/**
 * One entity table. `extraColumns` are the columns after the shared ones, and `toExtra` and
 * `fromRow` convert between a record and the table's row.
 */
const entityRepository = <T extends EntityRecord, R extends StampedRow>(
  db: SqlDatabase,
  accountId: string,
  table: string,
  extraColumns: string[],
  toRow: (record: T) => Array<string | number | null>,
  fromRow: (row: R) => T,
): EntityRepository<T> => {
  const columns = [
    'account_id',
    'id',
    'name',
    'name_hlc',
    'normalized_name',
    'created_hlc',
    'deleted_hlc',
    'merged_into',
    'seq',
    ...extraColumns,
  ];
  return {
    get: async (id) => {
      const row = db.get<R>(
        `SELECT * FROM ${table} WHERE account_id = ? AND id = ?`,
        [accountId, id],
      );
      return row ? fromRow(row) : null;
    },
    findLiveByNormalizedName: async (normalizedName) => {
      const row = db.get<R>(
        `SELECT * FROM ${table} WHERE account_id = ? AND normalized_name = ? AND deleted_hlc IS NULL`,
        [accountId, normalizedName],
      );
      return row ? fromRow(row) : null;
    },
    save: async (record) => {
      db.run(
        // An upsert, not INSERT OR REPLACE: REPLACE also deletes the other row that clashes on the
        // live-name index, where this must fail.
        `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})
         ON CONFLICT(account_id, id) DO UPDATE SET ${columns
           .slice(2)
           .map((column) => `${column} = excluded.${column}`)
           .join(', ')}`,
        [
          accountId,
          record.id,
          record.name,
          encodeHlc(record.nameHlc),
          record.normalizedName,
          encodeHlc(record.createdHlc),
          encodeOrNull(record.deletedHlc),
          record.mergedInto,
          record.seq,
          ...toRow(record),
        ],
      );
    },
    changedSince: async (seq, limit) =>
      db
        .all<R>(
          `SELECT * FROM ${table} WHERE account_id = ? AND seq > ? AND seq <= ${pageEnd(table)} ORDER BY seq, id`,
          [accountId, seq, accountId, seq, Math.max(limit - 1, 0)],
        )
        .map(fromRow),
  };
};

/**
 * The upper `seq` bound of a page (parameters: account, cursor, offset): the `seq` of the row of
 * the account that ends the page, so the rows sharing it come along; no bound when fewer rows
 * remain.
 */
const pageEnd = (table: string) =>
  `COALESCE((SELECT seq FROM ${table} WHERE account_id = ? AND seq > ? ORDER BY seq LIMIT 1 OFFSET ?), ${Number.MAX_SAFE_INTEGER})`;

type ItemRow = {
  list_id: string;
  article_id: string;
  present: number;
  present_hlc: string;
  in_cart: number;
  in_cart_hlc: string;
  quantity_amount: number | null;
  quantity_unit: string | null;
  quantity_hlc: string;
  seq: number;
};

const itemFromRow = (row: ItemRow): ListItemRecord => ({
  listId: row.list_id,
  articleId: row.article_id,
  present: row.present === 1,
  presentHlc: decodeHlc(row.present_hlc),
  inCart: row.in_cart === 1,
  inCartHlc: decodeHlc(row.in_cart_hlc),
  quantity:
    row.quantity_amount === null
      ? null
      : { amount: row.quantity_amount, unit: row.quantity_unit },
  quantityHlc: decodeHlc(row.quantity_hlc),
  seq: row.seq,
});

type DeviceRow = {
  id: string;
  account_id: string;
  name: string;
  credential_hash: string;
  created_at: string;
  last_sync_at: string | null;
  revoked_at: string | null;
};

const deviceFromRow = (row: DeviceRow): DeviceRecord => ({
  id: row.id,
  accountId: row.account_id,
  name: row.name,
  credentialHash: row.credential_hash,
  createdAt: row.created_at,
  lastSyncAt: row.last_sync_at,
  revokedAt: row.revoked_at,
});

/** The single meta row; a missing one means a damaged database, not a fresh server. */
const metaRow = (db: SqlDatabase) => {
  const row = db.get<{ server_id: string; seq: number }>(
    'SELECT server_id, seq FROM meta',
  );
  if (!row) throw new Error('The meta row is missing: the database is damaged');
  return row;
};

const articleFromRow = (row: ArticleRow): ArticleRecord => ({
  ...stamped(row),
  categoryId: row.category_id,
  categoryHlc: decodeHlc(row.category_hlc),
});

const articleRepository = (
  db: SqlDatabase,
  accountId: string,
): ArticleRepository => ({
  ...entityRepository<ArticleRecord, ArticleRow>(
    db,
    accountId,
    'article',
    ['category_id', 'category_hlc'],
    (record) => [record.categoryId, encodeHlc(record.categoryHlc)],
    articleFromRow,
  ),
  inCategory: async (categoryId) =>
    db
      .all<ArticleRow>(
        'SELECT * FROM article WHERE account_id = ? AND category_id = ? ORDER BY id',
        [accountId, categoryId],
      )
      .map(articleFromRow),
});

const dataRepositories = (
  db: SqlDatabase,
  accountId: string,
): Omit<Repositories, keyof DirectoryRepositories> => ({
  categories: entityRepository<CategoryRecord, CategoryRow>(
    db,
    accountId,
    'category',
    ['position', 'position_hlc'],
    (record) => [record.position, encodeHlc(record.positionHlc)],
    (row) => ({
      ...stamped(row),
      position: row.position,
      positionHlc: decodeHlc(row.position_hlc),
    }),
  ),
  articles: articleRepository(db, accountId),
  lists: entityRepository<ListRecord, StampedRow>(
    db,
    accountId,
    'shopping_list',
    [],
    () => [],
    stamped,
  ),
  items: {
    get: async (listId, articleId) => {
      const row = db.get<ItemRow>(
        'SELECT * FROM list_item WHERE account_id = ? AND list_id = ? AND article_id = ?',
        [accountId, listId, articleId],
      );
      return row ? itemFromRow(row) : null;
    },
    save: async (record) => {
      db.run(
        `INSERT OR REPLACE INTO list_item
           (account_id, list_id, article_id, present, present_hlc, in_cart, in_cart_hlc,
            quantity_amount, quantity_unit, quantity_hlc, seq)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          accountId,
          record.listId,
          record.articleId,
          record.present ? 1 : 0,
          encodeHlc(record.presentHlc),
          record.inCart ? 1 : 0,
          encodeHlc(record.inCartHlc),
          record.quantity?.amount ?? null,
          record.quantity?.unit ?? null,
          encodeHlc(record.quantityHlc),
          record.seq,
        ],
      );
    },
    forArticle: async (articleId) =>
      db
        .all<ItemRow>(
          'SELECT * FROM list_item WHERE account_id = ? AND article_id = ? ORDER BY list_id',
          [accountId, articleId],
        )
        .map(itemFromRow),
    forList: async (listId) =>
      db
        .all<ItemRow>(
          'SELECT * FROM list_item WHERE account_id = ? AND list_id = ? ORDER BY article_id',
          [accountId, listId],
        )
        .map(itemFromRow),
    changedSince: async (seq, limit) =>
      db
        .all<ItemRow>(
          `SELECT * FROM list_item WHERE account_id = ? AND seq > ? AND seq <= ${pageEnd('list_item')} ORDER BY seq, list_id, article_id`,
          [accountId, seq, accountId, seq, Math.max(limit - 1, 0)],
        )
        .map(itemFromRow),
  },
  appliedChanges: {
    has: async (changeId) =>
      db.get(
        'SELECT 1 FROM applied_change WHERE account_id = ? AND change_id = ?',
        [accountId, changeId],
      ) !== undefined,
    add: async (record: AppliedChangeRecord) => {
      db.run(
        'INSERT INTO applied_change (account_id, change_id, device_id, applied_at) VALUES (?, ?, ?, ?)',
        [accountId, record.changeId, record.deviceId, record.appliedAt],
      );
    },
  },
});

type AccountRow = {
  id: string;
  email: string | null;
  role: 'user' | 'administrator';
  password_hash: string | null;
  temporary_password_hash: string | null;
  temporary_expires_at: string | null;
  suspended_at: string | null;
  created_at: string;
};

const accountFromRow = (row: AccountRow): AccountRecord => ({
  id: row.id,
  email: row.email,
  role: row.role,
  passwordHash: row.password_hash,
  temporaryPasswordHash: row.temporary_password_hash,
  temporaryExpiresAt: row.temporary_expires_at,
  suspendedAt: row.suspended_at,
  createdAt: row.created_at,
});

const directoryRepositories = (db: SqlDatabase): DirectoryRepositories => ({
  meta: {
    serverId: async () => metaRow(db).server_id,
    currentSeq: async () => metaRow(db).seq,
    nextSeq: async () => {
      db.run('UPDATE meta SET seq = seq + 1');
      return metaRow(db).seq;
    },
  },
  accounts: {
    add: async (record) => {
      db.run(
        `INSERT INTO account
           (id, email, role, password_hash, temporary_password_hash, temporary_expires_at, suspended_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          record.id,
          record.email,
          record.role,
          record.passwordHash,
          record.temporaryPasswordHash,
          record.temporaryExpiresAt,
          record.suspendedAt,
          record.createdAt,
        ],
      );
    },
    get: async (id) => {
      const row = db.get<AccountRow>('SELECT * FROM account WHERE id = ?', [
        id,
      ]);
      return row ? accountFromRow(row) : null;
    },
    findByEmail: async (normalizedEmail) => {
      const row = db.get<AccountRow>('SELECT * FROM account WHERE email = ?', [
        normalizedEmail,
      ]);
      return row ? accountFromRow(row) : null;
    },
    update: async (record) => {
      db.run(
        `UPDATE account SET email = ?, role = ?, password_hash = ?, temporary_password_hash = ?,
           temporary_expires_at = ?, suspended_at = ?, created_at = ?
         WHERE id = ?`,
        [
          record.email,
          record.role,
          record.passwordHash,
          record.temporaryPasswordHash,
          record.temporaryExpiresAt,
          record.suspendedAt,
          record.createdAt,
          record.id,
        ],
      );
    },
    all: async () =>
      db
        .all<AccountRow>('SELECT * FROM account ORDER BY created_at, id')
        .map(accountFromRow),
    // The foreign keys' ON DELETE CASCADE remove its devices and all its data.
    delete: async (id) => {
      db.run('DELETE FROM account WHERE id = ?', [id]);
    },
    countOtherActiveAdministrators: async (id) =>
      db.get<{ n: number }>(
        `SELECT COUNT(*) AS n FROM account
         WHERE id != ? AND role = 'administrator' AND password_hash IS NOT NULL AND suspended_at IS NULL`,
        [id],
      )?.n ?? 0,
    lastSyncAt: async (id) =>
      db.get<{ at: string | null }>(
        'SELECT MAX(last_sync_at) AS at FROM device WHERE account_id = ?',
        [id],
      )?.at ?? null,
  },
  devices: {
    add: async (record) => {
      db.run(
        `INSERT INTO device (id, account_id, name, credential_hash, created_at, last_sync_at, revoked_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          record.id,
          record.accountId,
          record.name,
          record.credentialHash,
          record.createdAt,
          record.lastSyncAt,
          record.revokedAt,
        ],
      );
    },
    get: async (id) => {
      const row = db.get<DeviceRow>('SELECT * FROM device WHERE id = ?', [id]);
      return row ? deviceFromRow(row) : null;
    },
    findByCredentialHash: async (credentialHash) => {
      const row = db.get<DeviceRow>(
        'SELECT * FROM device WHERE credential_hash = ?',
        [credentialHash],
      );
      return row ? deviceFromRow(row) : null;
    },
    forAccount: async (accountId) =>
      db
        .all<DeviceRow>(
          'SELECT * FROM device WHERE account_id = ? ORDER BY created_at, id',
          [accountId],
        )
        .map(deviceFromRow),
    update: async (record) => {
      db.run(
        `UPDATE device SET name = ?, credential_hash = ?, created_at = ?, last_sync_at = ?, revoked_at = ?
         WHERE id = ?`,
        [
          record.name,
          record.credentialHash,
          record.createdAt,
          record.lastSyncAt,
          record.revokedAt,
          record.id,
        ],
      );
    },
  },
  endedCredentials: {
    add: async (credentialHash, reason, at) => {
      db.run(
        'INSERT INTO ended_credential (credential_hash, reason, ended_at) VALUES (?, ?, ?)',
        [credentialHash, reason, at],
      );
    },
    find: async (credentialHash) => {
      const row = db.get<{ reason: 'accountDeleted' }>(
        'SELECT reason FROM ended_credential WHERE credential_hash = ?',
        [credentialHash],
      );
      return row ? { reason: row.reason } : null;
    },
  },
  authAttempts: {
    add: async (kind, keyHash, at) => {
      db.run('INSERT INTO auth_attempt (kind, key_hash, at) VALUES (?, ?, ?)', [
        kind,
        keyHash,
        at,
      ]);
    },
    countSince: async (kind, keyHash, since) =>
      db.get<{ n: number }>(
        'SELECT COUNT(*) AS n FROM auth_attempt WHERE kind = ? AND key_hash = ? AND at >= ?',
        [kind, keyHash, since],
      )?.n ?? 0,
    earliestSince: async (kind, keyHash, since) =>
      db.get<{ at: string | null }>(
        'SELECT MIN(at) AS at FROM auth_attempt WHERE kind = ? AND key_hash = ? AND at >= ?',
        [kind, keyHash, since],
      )?.at ?? null,
    pruneBefore: async (before) => {
      db.run('DELETE FROM auth_attempt WHERE at < ?', [before]);
    },
    deleteForKey: async (keyHash) => {
      db.run('DELETE FROM auth_attempt WHERE key_hash = ?', [keyHash]);
    },
  },
});

/**
 * The server store on SQLite. A run is one `BEGIN IMMEDIATE` transaction, committed when the
 * work resolves and rolled back when it throws; runs are queued so two never overlap on the one
 * connection.
 */
export class SqliteStore implements ServerStore {
  private queue: Promise<unknown> = Promise.resolve();
  private readonly directory: DirectoryRepositories;

  constructor(private readonly db: SqlDatabase) {
    this.directory = directoryRepositories(db);
  }

  run<T>(work: (repos: DirectoryRepositories) => Promise<T>): Promise<T> {
    return this.transaction(() => work(this.directory));
  }

  runForAccount<T>(
    accountId: string,
    work: (repos: Repositories) => Promise<T>,
  ): Promise<T> {
    return this.transaction(() =>
      work({ ...this.directory, ...dataRepositories(this.db, accountId) }),
    );
  }

  private transaction<T>(work: () => Promise<T>): Promise<T> {
    const result = this.queue.then(async () => {
      this.db.exec('BEGIN IMMEDIATE');
      try {
        const value = await work();
        this.db.exec('COMMIT');
        return value;
      } catch (error) {
        rollbackQuietly(this.db);
        throw error;
      }
    });
    this.queue = result.catch(() => undefined);
    return result;
  }
}
