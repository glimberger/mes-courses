import {
  normalizeEmail,
  normalizeTemporaryPassword,
  validateNewPassword,
} from './account';

describe('normalizeEmail', () => {
  it('004 FR-001 gives the same address for capitals and surrounding spaces', () => {
    expect(normalizeEmail('  Marie.Dupont@Example.ORG ')).toBe(
      'marie.dupont@example.org',
    );
    expect(normalizeEmail('marie.dupont@example.org')).toBe(
      'marie.dupont@example.org',
    );
  });

  it.each([
    ['no @', 'marie.example.org'],
    ['two @', 'a@b@example.org'],
    ['no dot in the domain', 'marie@example'],
    ['an inner space', 'ma rie@example.org'],
    ['an empty local part', '@example.org'],
    ['an empty string', ''],
  ])('004 FR-001 refuses an address with %s', (_label, raw) => {
    expect(normalizeEmail(raw)).toBeNull();
  });

  it('004 FR-001 accepts 254 characters and refuses 255', () => {
    const domain = '@example.org';
    const ok = `${'a'.repeat(254 - domain.length)}${domain}`;
    expect(ok).toHaveLength(254);
    expect(normalizeEmail(ok)).toBe(ok);
    expect(normalizeEmail(`a${ok}`)).toBeNull();
  });
});

describe('validateNewPassword', () => {
  it('004 FR-005 refuses 11 code points and accepts 12', () => {
    expect(validateNewPassword('a'.repeat(11))).toBe('TooShort');
    expect(validateNewPassword('a'.repeat(12))).toBeNull();
  });

  it('004 FR-005 accepts 128 code points and refuses 129', () => {
    expect(validateNewPassword('a'.repeat(128))).toBeNull();
    expect(validateNewPassword('a'.repeat(129))).toBe('TooLong');
  });

  it('004 FR-005 counts an astral character as one code point', () => {
    expect(validateNewPassword('😀'.repeat(12))).toBeNull();
    expect(validateNewPassword('😀'.repeat(11))).toBe('TooShort');
    expect(validateNewPassword('😀'.repeat(128))).toBeNull();
    expect(validateNewPassword('😀'.repeat(129))).toBe('TooLong');
  });

  it('004 FR-005 counts a composed and a decomposed accent alike', () => {
    const nfc = 'é'.repeat(12);
    const nfd = 'é'.repeat(12);
    expect(validateNewPassword(nfc)).toBeNull();
    expect(validateNewPassword(nfd)).toBeNull();
    expect(validateNewPassword('é'.repeat(11))).toBe('TooShort');
  });

  it('004 FR-005 keeps leading and trailing spaces', () => {
    expect(validateNewPassword(`${' '.repeat(6)}abcdef`)).toBeNull();
    expect(validateNewPassword(`abcdef${' '.repeat(6)}`)).toBeNull();
    expect(validateNewPassword(`  ${'a'.repeat(9)}  `)).toBeNull();
    expect(validateNewPassword(`  ${'a'.repeat(7)}  `)).toBe('TooShort');
  });

  it('004 FR-005 refuses the temporary password in another case or with dashes', () => {
    const previous = { temporary: 'ABCD-EFGH-JKLM-NPQR' };
    expect(validateNewPassword('ABCD-EFGH-JKLM-NPQR', previous)).toBe(
      'SameAsTemporary',
    );
    expect(validateNewPassword('abcdefghjklmnpqr', previous)).toBe(
      'SameAsTemporary',
    );
    expect(validateNewPassword('abcd efgh jklm npqr', previous)).toBe(
      'SameAsTemporary',
    );
    expect(validateNewPassword('abcd-efgh-jklm-npqx', previous)).toBeNull();
  });

  it('004 US6-2 refuses the current password, compared after NFC', () => {
    expect(
      validateNewPassword('correct horse battery', {
        current: 'correct horse battery',
      }),
    ).toBe('SameAsCurrent');
    expect(
      validateNewPassword('é'.repeat(12), { current: 'é'.repeat(12) }),
    ).toBe('SameAsCurrent');
    expect(
      validateNewPassword('Correct horse battery', {
        current: 'correct horse battery',
      }),
    ).toBeNull();
  });

  it('004 R3 reports the length problem before the sameness one', () => {
    expect(validateNewPassword('short', { current: 'short' })).toBe('TooShort');
  });
});

describe('normalizeTemporaryPassword', () => {
  it('004 R3 ignores case, dashes and spaces', () => {
    expect(normalizeTemporaryPassword('abcd-efgh jklm-npqr')).toBe(
      'ABCDEFGHJKLMNPQR',
    );
  });
});
