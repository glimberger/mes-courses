import type { AccountRole, AccountState } from '@mes-courses/sync-core';

/** Every instant is an ISO 8601 string, which sorts like the time it names. */
type Instant = string;

/** The row the store keeps (data-model.md, "Server database (migration 2)"). */
export type AccountRecord = {
  id: string;
  /** Normalized. `null` only for the setup account (research R2). */
  email: string | null;
  role: AccountRole;
  /** `null` until the owner chooses one. */
  passwordHash: string | null;
  temporaryPasswordHash: string | null;
  temporaryExpiresAt: Instant | null;
  suspendedAt: Instant | null;
  createdAt: Instant;
};

/** A temporary password is valid for 7 days (FR-004). */
export const TEMPORARY_PASSWORD_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

/** Derived, never stored, so it cannot disagree with its causes. */
export const accountState = (record: AccountRecord): AccountState => {
  if (record.suspendedAt !== null) return 'suspended';
  return record.passwordHash === null ? 'invited' : 'active';
};

export const temporaryExpiresAt = (nowMs: number): Instant =>
  new Date(nowMs + TEMPORARY_PASSWORD_LIFETIME_MS).toISOString();

export const isTemporaryExpired = (
  record: AccountRecord,
  nowMs: number,
): boolean =>
  record.temporaryExpiresAt !== null &&
  Date.parse(record.temporaryExpiresAt) <= nowMs;

/** An invited account whose temporary password ran out (research R12). */
export const invitationExpired = (
  record: AccountRecord,
  nowMs: number,
): boolean =>
  accountState(record) === 'invited' &&
  record.temporaryPasswordHash !== null &&
  isTemporaryExpired(record, nowMs);

/**
 * An administrator can be suspended or deleted only while another active administrator remains
 * (FR-013, FR-016). An ordinary user always can.
 */
export const canLoseAdministrator = (
  account: Pick<AccountRecord, 'role'>,
  otherActiveAdministrators: number,
): boolean => account.role !== 'administrator' || otherActiveAdministrators > 0;
