import {
  cleanName,
  compareNames,
  normalizedName,
  searchForm,
  validateName,
} from './name';

const DECOMPOSED_E_ACUTE = 'e\u0301';

describe('cleanName', () => {
  it('FR-022 trims the name and reduces inner runs of white space to one space', () => {
    expect(cleanName('  Pommes \t de   terre ')).toBe('Pommes de terre');
  });

  it('FR-021 turns a letter followed by a combining accent into the composed letter', () => {
    expect(cleanName(DECOMPOSED_E_ACUTE)).toBe('é');
  });

  it('FR-022 counts a non-breaking space, a narrow non-breaking space, a tab and a line break as spaces', () => {
    expect(cleanName('Pommes\u00A0de\nterre')).toBe('Pommes de terre');
    expect(cleanName('Pommes\u202Fde\tterre')).toBe('Pommes de terre');
    expect(cleanName('\u00A0Pommes\u202F')).toBe('Pommes');
  });

  it('FR-022 removes zero-width spaces, joiners and byte order marks', () => {
    expect(cleanName('Pâte\u200Bs')).toBe('Pâtes');
    expect(cleanName('\uFEFFLait\u2060\u200C\u200D')).toBe('Lait');
  });
});

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

describe('normalizedName', () => {
  it.each([
    [' beurre ', 'Beurre'],
    ['BEURRE', 'Beurre'],
    ['Pommes  de terre', 'Pommes de terre'],
    ['Cre\u0300me', 'Crème'],
    ['Oeufs', 'Œufs'],
    ['Caesar', 'Cæsar'],
    ["Pâte d'amande", 'Pâte d\u2019amande'],
  ])('FR-021 treats "%s" as the same name as "%s"', (a, b) => {
    expect(normalizedName(a)).toBe(normalizedName(b));
  });

  it('FR-021 keeps accents, so "Pâte" and "Pâté" are different names', () => {
    expect(normalizedName('Pâte')).not.toBe(normalizedName('Pâté'));
  });

  it('FR-021 lowercases with the French locale and folds the ligatures and the curly apostrophe', () => {
    expect(normalizedName(' Œufs  de Pâques ')).toBe('oeufs de pâques');
    expect(normalizedName('CÆSAR d\u2019Été')).toBe("caesar d'été");
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
