import type { PasswordProblem } from './account';
import type { Hlc } from './hlc';

export type EntityKind = 'category' | 'article' | 'list' | 'listItem';

/** A quantity as synced: an amount and an optional unit. */
export type SyncedQuantity = { amount: number; unit: string | null };

export type SyncedFields = {
  category: { name: string; position: number };
  /** `deleted: true` is the intent to tombstone; the server turns it into `deletedHlc`. */
  article: { name: string; categoryId: string; deleted: true };
  list: { name: string };
  listItem: {
    listId: string;
    articleId: string;
    present: boolean;
    inCart: boolean;
    quantity: SyncedQuantity | null;
  };
};

/** One local change, sent in outbox order. A list item's id is `${listId}:${articleId}`. */
export type Change = {
  [K in EntityKind]: {
    /** UUID, makes a replay harmless (FR-006). */
    changeId: string;
    hlc: Hlc;
    kind: K;
    id: string;
    /** Only the fields this change sets. */
    fields: Partial<SyncedFields[K]>;
  };
}[EntityKind];

/** What a pull returns for one entity. */
export type ServerRow = {
  [K in EntityKind]: {
    kind: K;
    id: string;
    seq: number;
    // The tombstone is `deletedHlc` alone: a row never carries `deleted` as a field.
    fields: {
      [F in Exclude<keyof SyncedFields[K], 'deleted'>]?: {
        value: SyncedFields[K][F];
        hlc: Hlc;
      };
    };
    createdHlc: Hlc;
    /** Set for a tombstone: a deleted article, or an entity merged into another. */
    deletedHlc: Hlc | null;
    /** The survivor's id when the entity was merged by name (research R8). */
    mergedInto: string | null;
  };
}[EntityKind];

export const API_VERSION = 1;

/** Present on every server response. */
export type ServerIdentity = {
  serverId: string;
  apiVersion: number;
  minAppVersion: string;
  /** The caller's account, when authenticated or just signed in (004 research R9). */
  accountId?: string;
};

export type HealthInfo = ServerIdentity;

export type Pairing = ServerIdentity & {
  deviceId: string;
  /** 256-bit, base64url. Returned once; the server keeps only its SHA-256. */
  credential: string;
};

export const MAX_CHANGES_PER_REQUEST = 500;
export const MAX_ROWS_PER_RESPONSE = 5_000;

export type SyncRequest = {
  /** 0 on the first sync with this server. */
  lastSeq: number;
  hlc: Hlc;
  changes: Change[];
};

export type SyncResponse = ServerIdentity & {
  /** The changeIds applied now or already applied before. */
  acknowledged: string[];
  rows: ServerRow[];
  /** The new `lastSeq` of the device. */
  seq: number;
  /** The server's highest HLC. */
  hlc: Hlc;
  /** More rows remain: repeat with the returned `seq` and no changes. */
  more?: boolean;
};

export type DeviceSummary = {
  id: string;
  name: string;
  createdAt: string;
  lastSyncAt: string | null;
};

export type PairingCode = { code: string; expiresAt: string };

export const ERROR_CODES = {
  BadRequest: 400,
  DeviceNotAuthorized: 401,
  NotFound: 404,
  UpdateRequired: 426,
  TooManyAttempts: 429,
  ServerError: 500,
  /** Unknown, expired or used pairing code (claim route only). */
  InvalidCode: 400,
  InvalidCredentials: 401,
  TemporaryPasswordExpired: 401,
  AccountDeleted: 401,
  AccountSuspended: 403,
  Forbidden: 403,
  InvalidEmail: 400,
  InvalidPassword: 400,
  InvalidDeviceName: 400,
  AccountExists: 409,
  LastAdministrator: 409,
  NotInvited: 409,
  MailFailed: 502,
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export type ErrorBody = { error: ErrorCode };

/** `InvalidPassword` says which rule the new password breaks. */
export type InvalidPasswordBody = {
  error: 'InvalidPassword';
  problem: PasswordProblem;
};

// --- Accounts (feature 004) ---

export type AccountRole = 'user' | 'administrator';

/** Derived on the server, never stored. */
export type AccountState = 'invited' | 'active' | 'suspended';

/** One row of the administrator's list. */
export type AccountSummary = {
  id: string;
  email: string;
  role: AccountRole;
  state: AccountState;
  lastSyncAt: string | null;
  /** State `invited` and the temporary password expired. */
  invitationExpired: boolean;
};

/** What `GET /v1/account` and a sign-in return about the caller. */
export type AccountInfo = { id: string; email: string; role: AccountRole };

export type SignInRequest = {
  email: string;
  password: string;
  deviceName: string;
};

export type SignedInResponse = Pairing & {
  outcome: 'signedIn';
  account: AccountInfo;
  accountId: string;
};

export type PasswordChangeRequiredResponse = {
  outcome: 'passwordChangeRequired';
};

export type SignInResponse = SignedInResponse | PasswordChangeRequiredResponse;

export type ChoosePasswordRequest = {
  email: string;
  temporaryPassword: string;
  newPassword: string;
  deviceName: string;
};

export type ChoosePasswordResponse = SignedInResponse;

export type PasswordResetRequest = { email: string };

export type PasswordResetResponse = Record<string, never>;

export type AccountResponse = ServerIdentity & { account: AccountInfo };

export type ChangePasswordRequest = {
  currentPassword: string;
  newPassword: string;
};

export type DeleteAccountRequest = { password: string };

export type AccountsListResponse = ServerIdentity & {
  accounts: AccountSummary[];
};

export type InviteAccountRequest = { email: string };

export type InviteAccountResponse = ServerIdentity & {
  account: AccountSummary;
};
