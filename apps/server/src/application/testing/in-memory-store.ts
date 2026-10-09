import type {
  AppliedChangeRecord,
  ArticleRecord,
  CategoryRecord,
  DeviceRecord,
  EntityRecord,
  EntityRepository,
  ListItemRecord,
  ListRecord,
  PairingCodeRecord,
  Repositories,
  ServerStore,
} from '../ports/store';

type State = {
  serverId: string;
  seq: number;
  categories: Map<string, CategoryRecord>;
  articles: Map<string, ArticleRecord>;
  lists: Map<string, ListRecord>;
  items: Map<string, ListItemRecord>;
  appliedChanges: Map<string, AppliedChangeRecord>;
  devices: Map<string, DeviceRecord>;
  pairingCodes: Map<string, PairingCodeRecord>;
  pairingFailures: string[];
};

const bySeq = (a: { seq: number }, b: { seq: number }) => a.seq - b.seq;

const changedSince = <T extends { seq: number }>(
  rows: Map<string, T>,
  seq: number,
  limit: number,
): T[] =>
  [...rows.values()]
    .filter((row) => row.seq > seq)
    .sort(bySeq)
    .slice(0, limit)
    .map((row) => structuredClone(row));

const entityRepository = <T extends EntityRecord>(
  rows: Map<string, T>,
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
    rows.set(record.id, structuredClone(record));
  },
  changedSince: async (seq, limit) => changedSince(rows, seq, limit),
});

const itemKey = (listId: string, articleId: string) =>
  `${listId}\u0000${articleId}`;

const repositories = (state: State): Repositories => ({
  meta: {
    serverId: async () => state.serverId,
    currentSeq: async () => state.seq,
    nextSeq: async () => ++state.seq,
  },
  categories: entityRepository(state.categories),
  articles: entityRepository(state.articles),
  lists: entityRepository(state.lists),
  items: {
    get: async (listId, articleId) =>
      structuredClone(state.items.get(itemKey(listId, articleId)) ?? null),
    save: async (record) => {
      state.items.set(
        itemKey(record.listId, record.articleId),
        structuredClone(record),
      );
    },
    changedSince: async (seq, limit) => changedSince(state.items, seq, limit),
  },
  appliedChanges: {
    has: async (changeId) => state.appliedChanges.has(changeId),
    add: async (record) => {
      state.appliedChanges.set(record.changeId, { ...record });
    },
  },
  devices: {
    add: async (record) => {
      state.devices.set(record.id, { ...record });
    },
    get: async (id) => structuredClone(state.devices.get(id) ?? null),
    findByCredentialHash: async (credentialHash) =>
      structuredClone(
        [...state.devices.values()].find(
          (device) => device.credentialHash === credentialHash,
        ) ?? null,
      ),
    all: async () =>
      [...state.devices.values()]
        .sort(
          (a, b) =>
            a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
        )
        .map((device) => ({ ...device })),
    update: async (record) => {
      state.devices.set(record.id, { ...record });
    },
  },
  pairingCodes: {
    add: async (record) => {
      state.pairingCodes.set(record.codeHash, { ...record });
    },
    findByHash: async (codeHash) => {
      const found = state.pairingCodes.get(codeHash);
      return found ? { ...found } : null;
    },
    markUsed: async (codeHash, at) => {
      const found = state.pairingCodes.get(codeHash);
      if (found) state.pairingCodes.set(codeHash, { ...found, usedAt: at });
    },
  },
  pairingFailures: {
    add: async (at) => {
      state.pairingFailures.push(at);
    },
    countSince: async (since) =>
      state.pairingFailures.filter((at) => at >= since).length,
    earliestSince: async (since) =>
      state.pairingFailures.filter((at) => at >= since).sort()[0] ?? null,
  },
});

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
      categories: new Map(),
      articles: new Map(),
      lists: new Map(),
      items: new Map(),
      appliedChanges: new Map(),
      devices: new Map(),
      pairingCodes: new Map(),
      pairingFailures: [],
    };
  }

  run<T>(work: (repos: Repositories) => Promise<T>): Promise<T> {
    const result = this.queue.then(async () => {
      const draft = copyOf(this.state);
      const value = await work(repositories(draft));
      this.state = draft;
      return value;
    });
    this.queue = result.catch(() => undefined);
    return result;
  }
}
