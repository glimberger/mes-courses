import { BundledChangelog } from './bundled-changelog';

describe('BundledChangelog', () => {
  it('reads the bundled file, newest first, without any network call', () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    const releases = new BundledChangelog().read();

    expect(releases.length).toBeGreaterThan(0);
    expect(releases[0]).toEqual(
      expect.objectContaining({
        version: expect.stringMatching(/^\d+\.\d+\.\d+/),
        date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      }),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('keeps the features and fixes of a release as lines of text', () => {
    const releases = new BundledChangelog([
      {
        version: '1.0.0',
        date: '2026-01-01',
        features: [{ text: 'a feature', pr: 1 }],
        fixes: [{ text: 'a fix', pr: 2 }],
        performances: [],
        breaking: [],
      },
    ]).read();

    expect(releases).toEqual([
      {
        version: '1.0.0',
        date: '2026-01-01',
        features: [{ text: 'a feature' }],
        fixes: [{ text: 'a fix' }],
      },
    ]);
  });

  it.each([
    ['an empty file', []],
    ['a missing file', 'missing'],
    ['an object', {}],
    ['null', null],
  ])('gives no release for %s', (_name, data) => {
    expect(new BundledChangelog(data).read()).toEqual([]);
  });

  it('ignores a release without version or date and a malformed entry', () => {
    const releases = new BundledChangelog([
      { date: '2026-01-01' },
      'nonsense',
      {
        version: '1.0.0',
        date: '2026-01-01',
        features: [{}, 3, { text: 'ok' }],
      },
    ]).read();

    expect(releases).toEqual([
      {
        version: '1.0.0',
        date: '2026-01-01',
        features: [{ text: 'ok' }],
        fixes: [],
      },
    ]);
  });
});
