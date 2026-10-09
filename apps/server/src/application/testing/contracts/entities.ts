import type { Hlc } from '@mes-courses/sync-core';

import type {
  AppliedChangeRecord,
  ArticleRecord,
  CategoryRecord,
  DeviceRecord,
  ListItemRecord,
  ListRecord,
  PairingCodeRecord,
} from '../../ports/store';

/** Record builders for the contract suites, so each test states only what it is about. */
export const hlc = (wallMs: number, deviceId = 'd-1'): Hlc => ({
  wallMs,
  counter: 0,
  deviceId,
});

export const category = (
  id: string,
  name: string,
  overrides: Partial<CategoryRecord> = {},
): CategoryRecord => ({
  id,
  name,
  nameHlc: hlc(1),
  normalizedName: name.toLowerCase(),
  position: 0,
  positionHlc: hlc(1),
  createdHlc: hlc(1),
  deletedHlc: null,
  mergedInto: null,
  seq: 1,
  ...overrides,
});

export const article = (
  id: string,
  name: string,
  categoryId: string,
  overrides: Partial<ArticleRecord> = {},
): ArticleRecord => ({
  id,
  name,
  nameHlc: hlc(1),
  normalizedName: name.toLowerCase(),
  categoryId,
  categoryHlc: hlc(1),
  createdHlc: hlc(1),
  deletedHlc: null,
  mergedInto: null,
  seq: 1,
  ...overrides,
});

export const list = (
  id: string,
  name: string,
  overrides: Partial<ListRecord> = {},
): ListRecord => ({
  id,
  name,
  nameHlc: hlc(1),
  normalizedName: name.toLowerCase(),
  createdHlc: hlc(1),
  deletedHlc: null,
  mergedInto: null,
  seq: 1,
  ...overrides,
});

export const item = (
  listId: string,
  articleId: string,
  overrides: Partial<ListItemRecord> = {},
): ListItemRecord => ({
  listId,
  articleId,
  present: true,
  presentHlc: hlc(1),
  inCart: false,
  inCartHlc: hlc(1),
  quantity: null,
  quantityHlc: hlc(1),
  seq: 1,
  ...overrides,
});

export const device = (
  id: string,
  credentialHash: string,
  overrides: Partial<DeviceRecord> = {},
): DeviceRecord => ({
  id,
  name: 'Téléphone',
  credentialHash,
  createdAt: '2026-10-01T10:00:00.000Z',
  lastSyncAt: null,
  revokedAt: null,
  ...overrides,
});

export const pairingCode = (
  codeHash: string,
  overrides: Partial<PairingCodeRecord> = {},
): PairingCodeRecord => ({
  codeHash,
  createdBy: null,
  expiresAt: '2026-10-01T10:10:00.000Z',
  usedAt: null,
  ...overrides,
});

export const appliedChange = (
  changeId: string,
  overrides: Partial<AppliedChangeRecord> = {},
): AppliedChangeRecord => ({
  changeId,
  deviceId: 'd-1',
  appliedAt: '2026-10-01T10:00:00.000Z',
  ...overrides,
});
