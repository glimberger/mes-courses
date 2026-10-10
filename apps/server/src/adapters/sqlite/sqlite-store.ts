import { decodeHlc, encodeHlc, type Hlc } from '@mes-courses/sync-core';

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
  PairingCodeRecord,
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
  table: string,
  extraColumns: string[],
  toRow: (record: T) => Array<string | number | null>,
  fromRow: (row: R) => T,
): EntityRepository<T> => {
  const columns = [
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
      const row = db.get<R>(`SELECT * FROM ${table} WHERE id = ?`, [id]);
      return row ? fromRow(row) : null;
    },
    findLiveByNormalizedName: async (normalizedName) => {
      const row = db.get<R>(
        `SELECT * FROM ${table} WHERE normalized_name = ? AND deleted_hlc IS NULL`,
        [normalizedName],
      );
      return row ? fromRow(row) : null;
    },
    save: async (record) => {
      db.run(
        // An upsert, not INSERT OR REPLACE: REPLACE also deletes the other row that clashes on the
        // live-name index, where this must fail.
        `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})
         ON CONFLICT(id) DO UPDATE SET ${columns
           .slice(1)
           .map((column) => `${column} = excluded.${column}`)
           .join(', ')}`,
        [
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
          `SELECT * FROM ${table} WHERE seq > ? AND seq <= ${pageEnd(table)} ORDER BY seq, id`,
          [seq, seq, Math.max(limit - 1, 0)],
        )
        .map(fromRow),
  };
};

/**
 * The upper `seq` bound of a page (parameters: cursor, offset): the `seq` of the row that ends
 * the page, so the rows sharing it come along; no bound when fewer rows remain.
 */
const pageEnd = (table: string) =>
  `COALESCE((SELECT seq FROM ${table} WHERE seq > ? ORDER BY seq LIMIT 1 OFFSET ?), ${Number.MAX_SAFE_INTEGER})`;

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
  name: string;
  credential_hash: string;
  created_at: string;
  last_sync_at: string | null;
  revoked_at: string | null;
};

const deviceFromRow = (row: DeviceRow): DeviceRecord => ({
  id: row.id,
  name: row.name,
  credentialHash: row.credential_hash,
  createdAt: row.created_at,
  lastSyncAt: row.last_sync_at,
  revokedAt: row.revoked_at,
});

type PairingCodeRow = {
  code_hash: string;
  created_by: string | null;
  expires_at: string;
  used_at: string | null;
};

const pairingCodeFromRow = (row: PairingCodeRow): PairingCodeRecord => ({
  codeHash: row.code_hash,
  createdBy: row.created_by,
  expiresAt: row.expires_at,
  usedAt: row.used_at,
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

const articleRepository = (db: SqlDatabase): ArticleRepository => ({
  ...entityRepository<ArticleRecord, ArticleRow>(
    db,
    'article',
    ['category_id', 'category_hlc'],
    (record) => [record.categoryId, encodeHlc(record.categoryHlc)],
    articleFromRow,
  ),
  inCategory: async (categoryId) =>
    db
      .all<ArticleRow>(
        'SELECT * FROM article WHERE category_id = ? ORDER BY id',
        [categoryId],
      )
      .map(articleFromRow),
});

const repositories = (db: SqlDatabase): Repositories => ({
  meta: {
    serverId: async () => metaRow(db).server_id,
    currentSeq: async () => metaRow(db).seq,
    nextSeq: async () => {
      db.run('UPDATE meta SET seq = seq + 1');
      return metaRow(db).seq;
    },
  },
  categories: entityRepository<CategoryRecord, CategoryRow>(
    db,
    'category',
    ['position', 'position_hlc'],
    (record) => [record.position, encodeHlc(record.positionHlc)],
    (row) => ({
      ...stamped(row),
      position: row.position,
      positionHlc: decodeHlc(row.position_hlc),
    }),
  ),
  articles: articleRepository(db),
  lists: entityRepository<ListRecord, StampedRow>(
    db,
    'shopping_list',
    [],
    () => [],
    stamped,
  ),
  items: {
    get: async (listId, articleId) => {
      const row = db.get<ItemRow>(
        'SELECT * FROM list_item WHERE list_id = ? AND article_id = ?',
        [listId, articleId],
      );
      return row ? itemFromRow(row) : null;
    },
    save: async (record) => {
      db.run(
        `INSERT OR REPLACE INTO list_item
           (list_id, article_id, present, present_hlc, in_cart, in_cart_hlc,
            quantity_amount, quantity_unit, quantity_hlc, seq)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
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
          'SELECT * FROM list_item WHERE article_id = ? ORDER BY list_id',
          [articleId],
        )
        .map(itemFromRow),
    forList: async (listId) =>
      db
        .all<ItemRow>(
          'SELECT * FROM list_item WHERE list_id = ? ORDER BY article_id',
          [listId],
        )
        .map(itemFromRow),
    changedSince: async (seq, limit) =>
      db
        .all<ItemRow>(
          `SELECT * FROM list_item WHERE seq > ? AND seq <= ${pageEnd('list_item')} ORDER BY seq, list_id, article_id`,
          [seq, seq, Math.max(limit - 1, 0)],
        )
        .map(itemFromRow),
  },
  appliedChanges: {
    has: async (changeId) =>
      db.get('SELECT 1 FROM applied_change WHERE change_id = ?', [changeId]) !==
      undefined,
    add: async (record: AppliedChangeRecord) => {
      db.run(
        'INSERT INTO applied_change (change_id, device_id, applied_at) VALUES (?, ?, ?)',
        [record.changeId, record.deviceId, record.appliedAt],
      );
    },
  },
  devices: {
    add: async (record) => {
      db.run(
        `INSERT INTO device (id, name, credential_hash, created_at, last_sync_at, revoked_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          record.id,
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
    all: async () =>
      db
        .all<DeviceRow>('SELECT * FROM device ORDER BY created_at, id')
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
  pairingCodes: {
    add: async (record) => {
      db.run(
        'INSERT INTO pairing_code (code_hash, created_by, expires_at, used_at) VALUES (?, ?, ?, ?)',
        [record.codeHash, record.createdBy, record.expiresAt, record.usedAt],
      );
    },
    findByHash: async (codeHash) => {
      const row = db.get<PairingCodeRow>(
        'SELECT * FROM pairing_code WHERE code_hash = ?',
        [codeHash],
      );
      return row ? pairingCodeFromRow(row) : null;
    },
    markUsed: async (codeHash, at) => {
      db.run('UPDATE pairing_code SET used_at = ? WHERE code_hash = ?', [
        at,
        codeHash,
      ]);
    },
  },
  pairingFailures: {
    add: async (at) => {
      db.run('INSERT INTO pairing_failure (at) VALUES (?)', [at]);
    },
    countSince: async (since) =>
      db.get<{ n: number }>(
        'SELECT COUNT(*) AS n FROM pairing_failure WHERE at >= ?',
        [since],
      )?.n ?? 0,
    pruneBefore: async (before) => {
      db.run('DELETE FROM pairing_failure WHERE at < ?', [before]);
    },
    earliestSince: async (since) =>
      db.get<{ at: string | null }>(
        'SELECT MIN(at) AS at FROM pairing_failure WHERE at >= ?',
        [since],
      )?.at ?? null,
  },
});

/**
 * The server store on SQLite. A run is one `BEGIN IMMEDIATE` transaction, committed when the
 * work resolves and rolled back when it throws; runs are queued so two never overlap on the one
 * connection.
 */
export class SqliteStore implements ServerStore {
  private queue: Promise<unknown> = Promise.resolve();
  private readonly repos: Repositories;

  constructor(private readonly db: SqlDatabase) {
    this.repos = repositories(db);
  }

  run<T>(work: (repos: Repositories) => Promise<T>): Promise<T> {
    const result = this.queue.then(async () => {
      this.db.exec('BEGIN IMMEDIATE');
      try {
        const value = await work(this.repos);
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
