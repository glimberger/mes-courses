import { fixedServerUrl, ServerUrlNotConfigured } from './server-url';

describe('fixedServerUrl', () => {
  it.each([
    ['undefined', undefined],
    ['empty', ''],
    ['blank', '   '],
    ['malformed', 'not a url!'],
  ])('throws ServerUrlNotConfigured for a %s value', (_label, raw) => {
    expect(() => fixedServerUrl(raw, false)).toThrow(ServerUrlNotConfigured);
    expect(() => fixedServerUrl(raw, false)).toThrow(
      /EXPO_PUBLIC_DEFAULT_SERVER_URL/,
    );
  });

  it('adds https:// when no scheme is given', () => {
    expect(fixedServerUrl('courses.example.fr', false)).toBe(
      'https://courses.example.fr',
    );
  });

  it('refuses http:// unless insecure addresses are allowed', () => {
    expect(() => fixedServerUrl('http://127.0.0.1:3000', false)).toThrow(
      ServerUrlNotConfigured,
    );
    expect(fixedServerUrl('http://127.0.0.1:3000', true)).toBe(
      'http://127.0.0.1:3000',
    );
  });
});
