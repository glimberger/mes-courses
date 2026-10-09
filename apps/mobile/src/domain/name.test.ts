import { compareNames, searchForm, validateName } from './name';

const DECOMPOSED_E_ACUTE = 'e\u0301';

describe('validateName', () => {
  it('FR-022 returns the clean name', () => {
    expect(validateName('  Pommes   de terre ')).toEqual({
      ok: true,
      value: 'Pommes de terre',
    });
  });

  it.each([
    ['empty', ''],
    ['blank', ' \t\n\u00A0 '],
    ['made only of invisible characters', '\u200B\u200C\u200D\u2060\uFEFF'],
  ])(
    'US2-11 US3-6 US4-4 FR-022 refuses a name that is %s with NameRequired',
    (_, text) => {
      expect(validateName(text)).toEqual({
        ok: false,
        error: { type: 'NameRequired' },
      });
    },
  );

  it('FR-022 accepts a name of 60 characters', () => {
    expect(validateName('a'.repeat(60))).toEqual({
      ok: true,
      value: 'a'.repeat(60),
    });
  });

  it('FR-022 refuses a name of 61 characters with NameTooLong', () => {
    expect(validateName('a'.repeat(61))).toEqual({
      ok: false,
      error: { type: 'NameTooLong' },
    });
  });

  it('FR-022 counts the length after cleaning', () => {
    expect(validateName(`  ${'a'.repeat(30)}    ${'b'.repeat(29)}  `).ok).toBe(
      true,
    );
  });

  it('FR-022 counts the length in code points, so 60 emoji are accepted and 61 refused', () => {
    expect('🍎'.repeat(60)).toHaveLength(120);
    expect(validateName('🍎'.repeat(60)).ok).toBe(true);
    expect(validateName('🍎'.repeat(61))).toEqual({
      ok: false,
      error: { type: 'NameTooLong' },
    });
  });

  it('FR-022 counts a decomposed accented letter as one character after cleaning', () => {
    const cleaned = validateName(DECOMPOSED_E_ACUTE.repeat(30));
    expect(cleaned.ok && [...cleaned.value]).toHaveLength(30);
    expect(validateName(DECOMPOSED_E_ACUTE.repeat(60)).ok).toBe(true);
  });
});

describe('searchForm', () => {
  it.each([
    ['Épicerie', 'epicerie'],
    ['Œufs', 'oeufs'],
    ['Cæsar', 'caesar'],
    ['d\u2019amande', "d'amande"],
    ['  Cre\u0300me  fraîche ', 'creme fraiche'],
  ])('FR-009 the search form of "%s" is "%s"', (name, expected) => {
    expect(searchForm(name)).toBe(expected);
  });
});

describe('compareNames', () => {
  it('sorts by French collation, comparing numbers by value: "Lait 2 L" before "Lait 10 L"', () => {
    expect(['Lait 10 L', 'Lait 2 L'].sort(compareNames)).toEqual([
      'Lait 2 L',
      'Lait 10 L',
    ]);
  });

  it('sorts "Éclairs" between "Eau" and "Farine"', () => {
    expect(['Farine', 'Éclairs', 'Eau'].sort(compareNames)).toEqual([
      'Eau',
      'Éclairs',
      'Farine',
    ]);
  });

  it('ignores case', () => {
    expect(['beurre', 'Ananas', 'Citron'].sort(compareNames)).toEqual([
      'Ananas',
      'beurre',
      'Citron',
    ]);
  });
});
