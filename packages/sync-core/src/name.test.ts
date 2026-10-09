import { cleanName, normalizedName } from './name';

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
