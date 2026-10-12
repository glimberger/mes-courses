import { mailConfig, publicUrl } from './config';

describe('mailConfig', () => {
  it('004 uses the console mailer when no SMTP address is set outside production', () => {
    expect(mailConfig({})).toEqual({ mode: 'console' });
    expect(mailConfig({ NODE_ENV: 'development' })).toEqual({
      mode: 'console',
    });
  });

  it('004 makes every send fail in production when the SMTP address is empty', () => {
    expect(
      mailConfig({ NODE_ENV: 'production', MES_COURSES_SMTP_URL: '' }),
    ).toEqual({
      mode: 'unconfigured',
    });
  });

  it('004 reads the SMTP address and the sender', () => {
    expect(
      mailConfig({
        MES_COURSES_SMTP_URL: 'smtp://user:secret@mail.example.org:587',
        MES_COURSES_MAIL_FROM: 'courses@example.org',
      }),
    ).toEqual({
      mode: 'smtp',
      url: 'smtp://user:secret@mail.example.org:587',
      from: 'courses@example.org',
    });
  });

  it('004 never prints the SMTP address in an error', () => {
    expect(() =>
      mailConfig({
        MES_COURSES_SMTP_URL: 'smtp://user:secret@mail.example.org',
      }),
    ).toThrow(/MES_COURSES_MAIL_FROM/);
    try {
      mailConfig({
        MES_COURSES_SMTP_URL: 'smtp://user:secret@mail.example.org',
      });
    } catch (error) {
      expect(String(error)).not.toContain('secret');
    }
  });
});

describe('publicUrl', () => {
  it('004 drops trailing slashes from the configured address', () => {
    expect(
      publicUrl({ MES_COURSES_PUBLIC_URL: 'https://courses.example.fr/' }),
    ).toBe('https://courses.example.fr');
  });

  it('004 falls back to the local address outside production and refuses to in production', () => {
    expect(publicUrl({ MES_COURSES_PORT: '4000' })).toBe(
      'http://127.0.0.1:4000',
    );
    expect(() => publicUrl({ NODE_ENV: 'production' })).toThrow(
      /MES_COURSES_PUBLIC_URL/,
    );
  });
});
