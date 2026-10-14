import type { AccountRecord } from '../../domain/account';
import type { AttemptKind } from '../../domain/attempts';
import type {
  AppliedChangeRecord,
  ArticleRecord,
  CategoryRecord,
  DeviceRecord,
  EntityRecord,
  EntityRepository,
  ListItemRecord,
  ListRecord,
  DirectoryRepositories,
  Repositories,
  ServerStore,
} from '../ports/store';

/** One account's data. Deleting the account drops it whole, which is the cascade. */
type AccountData = {
  categories: Map<string, CategoryRecord>;
  articles: Map<string, ArticleRecord>;
  lists: Map<string, ListRecord>;
  items: Map<string, ListItemRecord>;
  appliedChanges: Map<string, AppliedChangeRecord>;
};

type State = {
  serverId: string;
  seq: number;
  accounts: Map<string, AccountRecord>;
  data: Map<string, AccountData>;
  devices: Map<string, DeviceRecord>;
  endedCredentials: Map<string, 'accountDeleted'>;
  authAttempts: Array<{ kind: AttemptKind; keyHash: string; at: string }>;
};

const emptyData = (): AccountData => ({
  categories: new Map(),
  articles: new Map(),
  lists: new Map(),
  items: new Map(),
  appliedChanges: new Map(),
});

/** The data of an account; an account without any row has none yet. */
const dataOf = (state: State, accountId: string): AccountData => {
  let data = state.data.get(accountId);
  if (data === undefined) {
    data = emptyData();
    state.data.set(accountId, data);
  }
  return data;
};

const bySeq = (a: { seq: number }, b: { seq: number }) => a.seq - b.seq;

const changedSince = <T extends { seq: number }>(
  rows: Map<string, T>,
  seq: number,
  limit: number,
): T[] => {
  const changed = [...rows.values()].filter((row) => row.seq > seq).sort(bySeq);
  // A page ends on a whole `seq`: the rows of one change are never split.
  const end = changed[Math.max(limit - 1, 0)]?.seq ?? Infinity;
  return changed
    .filter((row) => row.seq <= end)
    .map((row) => structuredClone(row));
};

const entityRepository = <T extends EntityRecord>(
  rows: Map<string, T>,
  checkReferences: (record: T) => void = () => undefined,
): EntityRepository<T> => ({
  get: async (id) => structuredClone(rows.get(id) ?? null),
  findLiveByNormalizedName: async (normalizedName) =>
    structuredClone(
      [...rows.values()].find(
        (row) =>
          row.normalizedName === normalizedName && row.deletedHlc === null,
      ) ?? null,
    ),
  save: async (record) => {
    checkReferences(record);
    // The live-name unique index of the SQLite schema.
    const clash = [...rows.values()].find(
      (row) =>
        row.id !== record.id &&
        row.deletedHlc === null &&
        record.deletedHlc === null &&
        row.normalizedName === record.normalizedName,
    );
    if (clash)
      throw new Error(`Live name already taken: ${record.normalizedName}`);
    rows.set(record.id, structuredClone(record));
  },
  changedSince: async (seq, limit) => changedSince(rows, seq, limit),
});

const itemKey = (listId: string, articleId: string) =>
  `${listId}\u0000${articleId}`;

const directory = (state: State): DirectoryRepositories => ({
  meta: {
    serverId: async () => state.serverId,
    currentSeq: async () => state.seq,
    nextSeq: async () => ++state.seq,
  },
  accounts: {
    add: async (record) => {
      if (state.accounts.has(record.id)) {
        throw new Error(`Account already exists: ${record.id}`);
      }
      if (
        record.email !== null &&
        [...state.accounts.values()].some((a) => a.email === record.email)
      ) {
        throw new Error('Email already used');
      }
      state.accounts.set(record.id, { ...record });
    },
    get: async (id) => {
      const found = state.accounts.get(id);
      return found ? { ...found } : null;
    },
    findByEmail: async (normalizedEmail) => {
      const found = [...state.accounts.values()].find(
        (a) => a.email === normalizedEmail,
      );
      return found ? { ...found } : null;
    },
    update: async (record) => {
      state.accounts.set(record.id, { ...record });
    },
    all: async () =>
      [...state.accounts.values()]
        .sort(
          (a, b) =>
            a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
        )
        .map((a) => ({ ...a })),
    delete: async (id) => {
      // The cascade of the SQLite schema: devices and data go with the account.
      state.accounts.delete(id);
      state.data.delete(id);
      for (const [deviceId, device] of state.devices) {
        if (device.accountId === id) state.devices.delete(deviceId);
      }
    },
    countOtherActiveAdministrators: async (id) =>
      [...state.accounts.values()].filter(
        (a) =>
          a.id !== id &&
          a.role === 'administrator' &&
          a.passwordHash !== null &&
          a.suspendedAt === null,
      ).length,
    lastSyncAt: async (id) =>
      [...state.devices.values()]
        .filter((device) => device.accountId === id)
        .map((device) => device.lastSyncAt)
        .filter((at): at is string => at !== null)
        .sort()
        .pop() ?? null,
  },
  devices: {
    add: async (record) => {
      if (!state.accounts.has(record.accountId)) {
        throw new Error(`Unknown account: ${record.accountId}`);
      }
      const taken = [...state.devices.values()].some(
        (device) =>
          device.id === record.id ||
          device.credentialHash === record.credentialHash,
      );
      if (taken) throw new Error(`Device already exists: ${record.id}`);
      state.devices.set(record.id, { ...record });
    },
    get: async (id) => structuredClone(state.devices.get(id) ?? null),
    findByCredentialHash: async (credentialHash) =>
      structuredClone(
        [...state.devices.values()].find(
          (device) => device.credentialHash === credentialHash,
        ) ?? null,
      ),
    forAccount: async (accountId) =>
      [...state.devices.values()]
        .filter((device) => device.accountId === accountId)
        .sort(
          (a, b) =>
            a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
        )
        .map((device) => ({ ...device })),
    update: async (record) => {
      state.devices.set(record.id, { ...record });
    },
  },
  endedCredentials: {
    add: async (credentialHash, reason) => {
      if (state.endedCredentials.has(credentialHash)) {
        throw new Error('Credential already ended');
      }
      state.endedCredentials.set(credentialHash, reason);
    },
    find: async (credentialHash) => {
      const reason = state.endedCredentials.get(credentialHash);
      return reason === undefined ? null : { reason };
    },
  },
  authAttempts: {
    add: async (kind, keyHash, at) => {
      state.authAttempts.push({ kind, keyHash, at });
    },
    countSince: async (kind, keyHash, since) =>
      state.authAttempts.filter(
        (a) => a.kind === kind && a.keyHash === keyHash && a.at >= since,
      ).length,
    earliestSince: async (kind, keyHash, since) =>
      state.authAttempts
        .filter(
          (a) => a.kind === kind && a.keyHash === keyHash && a.at >= since,
        )
        .map((a) => a.at)
        .sort()[0] ?? null,
    pruneBefore: async (before) => {
      state.authAttempts = state.authAttempts.filter((a) => a.at >= before);
    },
    deleteForKey: async (keyHash) => {
      state.authAttempts = state.authAttempts.filter(
        (a) => a.keyHash !== keyHash,
      );
    },
  },
});

/** The data repositories of one account: they only ever see its maps. */
const dataRepositories = (
  state: State,
  accountId: string,
): Omit<Repositories, keyof DirectoryRepositories> => {
  const data = dataOf(state, accountId);
  return {
    categories: entityRepository(data.categories),
    articles: {
      ...entityRepository(data.articles, (record) => {
        // The composite foreign key of the SQLite schema: a row points inside its account.
        if (!data.categories.has(record.categoryId)) {
          throw new Error(`Unknown category: ${record.categoryId}`);
        }
      }),
      inCategory: async (categoryId) =>
        [...data.articles.values()]
          .filter((article) => article.categoryId === categoryId)
          .sort((a, b) => a.id.localeCompare(b.id))
          .map((article) => structuredClone(article)),
    },
    lists: entityRepository(data.lists),
    items: {
      get: async (listId, articleId) =>
        structuredClone(data.items.get(itemKey(listId, articleId)) ?? null),
      save: async (record) => {
        if (
          !data.lists.has(record.listId) ||
          !data.articles.has(record.articleId)
        ) {
          throw new Error('List item points outside its account');
        }
        data.items.set(
          itemKey(record.listId, record.articleId),
          structuredClone(record),
        );
      },
      forArticle: async (articleId) =>
        [...data.items.values()]
          .filter((row) => row.articleId === articleId)
          .sort((a, b) => a.listId.localeCompare(b.listId))
          .map((row) => structuredClone(row)),
      forList: async (listId) =>
        [...data.items.values()]
          .filter((row) => row.listId === listId)
          .sort((a, b) => a.articleId.localeCompare(b.articleId))
          .map((row) => structuredClone(row)),
      changedSince: async (seq, limit) => changedSince(data.items, seq, limit),
    },
    appliedChanges: {
      has: async (changeId) => data.appliedChanges.has(changeId),
      add: async (record) => {
        if (data.appliedChanges.has(record.changeId)) {
          throw new Error(`Change already applied: ${record.changeId}`);
        }
        data.appliedChanges.set(record.changeId, { ...record });
      },
    },
  };
};

const copyOf = (state: State): State => structuredClone(state);

/**
 * The server store on plain maps. A run works on a copy that replaces the state only when the
 * work resolves, which is the rollback on throw; runs are queued, never overlapped.
 */
export class InMemoryStore implements ServerStore {
  private state: State;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(serverId = 'server-1') {
    this.state = {
      serverId,
      seq: 0,
      accounts: new Map(),
      data: new Map(),
      devices: new Map(),
      endedCredentials: new Map(),
      authAttempts: [],
    };
  }

  run<T>(work: (repos: DirectoryRepositories) => Promise<T>): Promise<T> {
    return this.transaction((draft) => work(directory(draft)));
  }

  runForAccount<T>(
    accountId: string,
    work: (repos: Repositories) => Promise<T>,
  ): Promise<T> {
    return this.transaction((draft) =>
      work({ ...directory(draft), ...dataRepositories(draft, accountId) }),
    );
  }

  private transaction<T>(work: (draft: State) => Promise<T>): Promise<T> {
    const result = this.queue.then(async () => {
      const draft = copyOf(this.state);
      const value = await work(draft);
      this.state = draft;
      return value;
    });
    this.queue = result.catch(() => undefined);
    return result;
  }
}
