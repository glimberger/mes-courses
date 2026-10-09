import type { Hlc } from '@mes-courses/sync-core';

/** Every instant is an ISO 8601 string, which sorts like the time it names. */
export type Instant = string;

type Stamped = {
  createdHlc: Hlc;
  /** A tombstone: a deleted article, or an entity merged into another. */
  deletedHlc: Hlc | null;
  /** The survivor's id when the entity was merged by name (research R8). */
  mergedInto: string | null;
  /** The change counter value of the last change that touched the row. */
  seq: number;
};

export type CategoryRecord = Stamped & {
  id: string;
  name: string;
  nameHlc: Hlc;
  normalizedName: string;
  position: number;
  positionHlc: Hlc;
};

export type ArticleRecord = Stamped & {
  id: string;
  name: string;
  nameHlc: Hlc;
  normalizedName: string;
  categoryId: string;
  categoryHlc: Hlc;
};

export type ListRecord = Stamped & {
  id: string;
  name: string;
  nameHlc: Hlc;
  normalizedName: string;
};

export type ListItemRecord = {
  listId: string;
  articleId: string;
  present: boolean;
  presentHlc: Hlc;
  inCart: boolean;
  inCartHlc: Hlc;
  quantity: { amount: number; unit: string | null } | null;
  quantityHlc: Hlc;
  seq: number;
};

export type DeviceRecord = {
  id: string;
  name: string;
  /** SHA-256 of the device credential (research R11). */
  credentialHash: string;
  createdAt: Instant;
  lastSyncAt: Instant | null;
  revokedAt: Instant | null;
};

export type PairingCodeRecord = {
  /** SHA-256 of the normalized 8-character code. */
  codeHash: string;
  /** `null` when the code was created on the Pi itself. */
  createdBy: string | null;
  expiresAt: Instant;
  usedAt: Instant | null;
};

export type AppliedChangeRecord = {
  changeId: string;
  deviceId: string;
  appliedAt: Instant;
};

export interface MetaRepository {
  serverId(): Promise<string>;
  /** The last `seq` handed out; `0` before any change. */
  currentSeq(): Promise<number>;
  /** Increments the counter and returns the new value. */
  nextSeq(): Promise<number>;
}

export type EntityRecord = CategoryRecord | ArticleRecord | ListRecord;

/** What categories, articles and lists share. */
export interface EntityRepository<T extends EntityRecord> {
  get(id: string): Promise<T | null>;
  /** The live (not tombstoned) row with this normalized name, if any. */
  findLiveByNormalizedName(normalizedName: string): Promise<T | null>;
  /** Inserts the row, or replaces the one with the same id. */
  save(record: T): Promise<void>;
  /**
   * Rows with `seq` greater than the given one, by increasing `seq`. Rows of one change share a
   * `seq`, so a page never splits them: it holds at least `limit` rows when there are that many,
   * and ends on a whole `seq`. The next cursor is the last row's `seq`.
   */
  changedSince(seq: number, limit: number): Promise<T[]>;
}

export type CategoryRepository = EntityRepository<CategoryRecord>;
export type ArticleRepository = EntityRepository<ArticleRecord>;
export type ListRepository = EntityRepository<ListRecord>;

export interface ListItemRepository {
  get(listId: string, articleId: string): Promise<ListItemRecord | null>;
  save(record: ListItemRecord): Promise<void>;
  /** As `EntityRepository.changedSince`: a page never splits the rows sharing one `seq`. */
  changedSince(seq: number, limit: number): Promise<ListItemRecord[]>;
}

export interface AppliedChangeRepository {
  has(changeId: string): Promise<boolean>;
  add(record: AppliedChangeRecord): Promise<void>;
}

export interface DeviceRepository {
  add(record: DeviceRecord): Promise<void>;
  get(id: string): Promise<DeviceRecord | null>;
  findByCredentialHash(credentialHash: string): Promise<DeviceRecord | null>;
  /** By creation time, then id. */
  all(): Promise<DeviceRecord[]>;
  /** Replaces the row with the same id. */
  update(record: DeviceRecord): Promise<void>;
}

export interface PairingCodeRepository {
  add(record: PairingCodeRecord): Promise<void>;
  findByHash(codeHash: string): Promise<PairingCodeRecord | null>;
  markUsed(codeHash: string, at: Instant): Promise<void>;
}

export interface PairingFailureRepository {
  add(at: Instant): Promise<void>;
  /** Failures recorded at or after `since`. */
  countSince(since: Instant): Promise<number>;
  /** The earliest failure recorded at or after `since`, if any. */
  earliestSince(since: Instant): Promise<Instant | null>;
  /** Forgets the failures recorded before `before`, which no rate-limit window reads any more. */
  pruneBefore(before: Instant): Promise<void>;
}

export type Repositories = {
  meta: MetaRepository;
  categories: CategoryRepository;
  articles: ArticleRepository;
  lists: ListRepository;
  items: ListItemRepository;
  appliedChanges: AppliedChangeRepository;
  devices: DeviceRepository;
  pairingCodes: PairingCodeRepository;
  pairingFailures: PairingFailureRepository;
};

export interface ServerStore {
  /**
   * Runs the work as one transaction: everything it wrote is kept when it resolves, nothing is
   * when it throws (the error is rethrown). Runs never overlap.
   */
  run<T>(work: (repos: Repositories) => Promise<T>): Promise<T>;
}
