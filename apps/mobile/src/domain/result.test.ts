import { err, ok, type Result } from './result';

describe('Result', () => {
  it('ok wraps a value as a success', () => {
    expect(ok(42)).toEqual({ ok: true, value: 42 });
  });

  it('err wraps an error as a failure', () => {
    expect(err({ type: 'NameRequired' })).toEqual({
      ok: false,
      error: { type: 'NameRequired' },
    });
  });

  it('checking ok narrows to the value or to the error', () => {
    const summarize = (result: Result<number, { type: 'Broken' }>): string =>
      result.ok ? `value ${result.value + 1}` : `error ${result.error.type}`;

    expect(summarize(ok(1))).toBe('value 2');
    expect(summarize(err({ type: 'Broken' }))).toBe('error Broken');
  });
});
