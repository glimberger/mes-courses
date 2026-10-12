import {
  accountState,
  canLoseAdministrator,
  invitationExpired,
  isTemporaryExpired,
  temporaryExpiresAt,
  type AccountRecord,
} from './account';

const NOW = Date.parse('2026-10-12T10:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

const account = (overrides: Partial<AccountRecord> = {}): AccountRecord => ({
  id: 'a-1',
  email: 'marie@example.org',
  role: 'user',
  passwordHash: null,
  temporaryPasswordHash: null,
  temporaryExpiresAt: null,
  suspendedAt: null,
  createdAt: '2026-10-01T10:00:00.000Z',
  ...overrides,
});

describe('accountState', () => {
  it('004 is invited until a password is chosen', () => {
    expect(accountState(account())).toBe('invited');
  });

  it('004 is active once a password is set', () => {
    expect(accountState(account({ passwordHash: 'h' }))).toBe('active');
  });

  it('004 is suspended whatever else holds, and an outstanding temporary password does not change it', () => {
    const suspendedAt = '2026-10-02T10:00:00.000Z';
    expect(accountState(account({ suspendedAt }))).toBe('suspended');
    expect(accountState(account({ suspendedAt, passwordHash: 'h' }))).toBe(
      'suspended',
    );
    expect(
      accountState(
        account({
          passwordHash: 'h',
          temporaryPasswordHash: 't',
          temporaryExpiresAt: '2026-10-09T10:00:00.000Z',
        }),
      ),
    ).toBe('active');
  });
});

describe('temporary password lifetime', () => {
  it('004 FR-004 expires 7 days after it is made', () => {
    expect(temporaryExpiresAt(NOW)).toBe('2026-10-19T10:00:00.000Z');
  });

  it('004 FR-004 is expired exactly at the expiry instant, not before', () => {
    const record = account({
      temporaryPasswordHash: 't',
      temporaryExpiresAt: temporaryExpiresAt(NOW),
    });
    expect(isTemporaryExpired(record, NOW + 7 * DAY - 1)).toBe(false);
    expect(isTemporaryExpired(record, NOW + 7 * DAY)).toBe(true);
    expect(isTemporaryExpired(account(), NOW + 100 * DAY)).toBe(false);
  });
});

describe('invitationExpired', () => {
  const expired = {
    temporaryPasswordHash: 't',
    temporaryExpiresAt: '2026-10-05T10:00:00.000Z',
  };

  it('004 R12 flags an invited account whose temporary password expired', () => {
    expect(invitationExpired(account(expired), NOW)).toBe(true);
  });

  it('004 R12 does not flag an active account with an expired temporary password (a reset nobody used)', () => {
    expect(
      invitationExpired(account({ ...expired, passwordHash: 'h' }), NOW),
    ).toBe(false);
  });

  it('004 R12 does not flag an invited account still within its 7 days', () => {
    expect(
      invitationExpired(
        account({ ...expired, temporaryExpiresAt: '2026-10-15T10:00:00.000Z' }),
        NOW,
      ),
    ).toBe(false);
  });
});

describe('canLoseAdministrator', () => {
  it('004 FR-013 refuses to remove the last active administrator', () => {
    expect(canLoseAdministrator({ role: 'administrator' }, 0)).toBe(false);
  });

  it('004 FR-013 allows it while another active administrator remains', () => {
    expect(canLoseAdministrator({ role: 'administrator' }, 1)).toBe(true);
  });

  it('004 FR-013 always allows it for an ordinary user', () => {
    expect(canLoseAdministrator({ role: 'user' }, 0)).toBe(true);
  });
});
