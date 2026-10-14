import type {
  AccountInfo,
  AccountSummary,
  ErrorCode,
  InvalidPasswordBody,
  SignInResponse,
} from './protocol';
import { ERROR_CODES } from './protocol';

// Compile-time pin of the shapes of 004's contract (no runtime dependency on a type-test library).
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
const assertType = <T extends true>(): T | undefined => undefined;

assertType<
  Equal<
    AccountInfo,
    { id: string; email: string; role: 'user' | 'administrator' }
  >
>();
assertType<
  Equal<
    AccountSummary,
    {
      id: string;
      email: string;
      role: 'user' | 'administrator';
      state: 'invited' | 'active' | 'suspended';
      lastSyncAt: string | null;
      invitationExpired: boolean;
    }
  >
>();
assertType<
  Equal<
    Extract<SignInResponse, { outcome: 'passwordChangeRequired' }>,
    { outcome: 'passwordChangeRequired' }
  >
>();
assertType<
  Equal<
    InvalidPasswordBody['problem'],
    'TooShort' | 'TooLong' | 'SameAsTemporary' | 'SameAsCurrent'
  >
>();

describe('protocol', () => {
  it('004 the signed-in response carries the account and its id', () => {
    const response = {} as Extract<SignInResponse, { outcome: 'signedIn' }>;
    const id: string = response.accountId;
    const account: AccountInfo = response.account;
    expect([id, account]).toBeDefined();
  });

  it('004 contract: every new error code has the status of auth-api.md', () => {
    const expected: Partial<Record<ErrorCode, number>> = {
      InvalidCredentials: 401,
      TemporaryPasswordExpired: 401,
      AccountSuspended: 403,
      AccountDeleted: 401,
      Forbidden: 403,
      InvalidEmail: 400,
      InvalidPassword: 400,
      InvalidDeviceName: 400,
      AccountExists: 409,
      LastAdministrator: 409,
      NotInvited: 409,
      MailFailed: 502,
    };
    for (const [code, status] of Object.entries(expected)) {
      expect(ERROR_CODES[code as ErrorCode]).toBe(status);
    }
  });
});
