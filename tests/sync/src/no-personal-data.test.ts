import {
  FakeClock,
  RecordingErrorReporter,
  buildTestAppStack,
  createAppStore,
} from '@mes-courses/mobile/testing';
import { startTestServer, type TestServer } from '@mes-courses/server/testing';

import { PASSWORD } from './testing/onboard';

const START = Date.parse('2026-10-12T10:00:00.000Z');
const ADMIN_EMAIL = 'admin@example.org';
const MARIE = 'marie@example.org';
const PAUL = 'paul@example.org';
const LUCIE = 'lucie@example.org';
const NEW_PASSWORD = 'a brand new password';
const WRONG_PASSWORD = 'not the right password';
const DEVICE_NAMES = ['Pixel de Marie', 'Tablette de Paul', 'Telephone admin'];

/** The contexts of ui-screens.md, "Error reports (Principle VIII)". */
const APP_OPERATIONS = [
  'sync',
  'signIn',
  'choosePassword',
  'requestPasswordReset',
  'changePassword',
  'deleteAccount',
  'signOut',
  'listAccounts',
  'inviteAccount',
  'suspendAccount',
  'deleteAccountAsAdmin',
  'resendCredentials',
];
const APP_SCREENS = ['Settings', 'SignIn', 'ChoosePassword', 'Accounts'];

describe('no personal data in logs and reports (004 SC-008)', () => {
  let server: TestServer;
  let clock: FakeClock;
  let logLines: string[];
  let secrets: string[];

  beforeEach(async () => {
    clock = new FakeClock(START);
    logLines = [];
    secrets = [];
    server = await startTestServer({
      clock,
      logSink: (line) => void logLines.push(line),
    });
  });
  afterEach(async () => {
    await server.close();
  });

  const serialize = (value: unknown) =>
    JSON.stringify(value, (_key, item: unknown) =>
      item instanceof Error
        ? { ...item, name: item.name, message: item.message }
        : item,
    );

  /** A device with its own store and recording reporter, as the app wires them. */
  const newApp = async () => {
    const stack = await buildTestAppStack({ serverUrl: server.url, clock });
    const reporter = new RecordingErrorReporter();
    const store = createAppStore({
      useCases: stack.useCases,
      errorReporter: reporter,
    });
    return { stack, reporter, state: () => store.getState() };
  };
  type App = Awaited<ReturnType<typeof newApp>>;

  const requestAndWait = async (action: () => Promise<unknown>) => {
    await action();
    // A reset mail goes out after the answer: let it settle.
    await new Promise((resolve) => setTimeout(resolve, 20));
  };

  /** Everything that happened, each step with the secrets it brings. */
  const scenario = async () => {
    const admin = await server.createAccount({
      role: 'administrator',
      email: ADMIN_EMAIL,
    });
    secrets.push(admin.deviceCredential);
    const adminApp = await newApp();
    await adminApp
      .state()
      .signIn(server.url, ADMIN_EMAIL, PASSWORD, DEVICE_NAMES[2] ?? '');

    // Invitation, first sign-in with the temporary password.
    await adminApp.state().inviteAccount(MARIE);
    const invitation = server.mails().at(-1);
    const temporary =
      invitation && 'temporaryPassword' in invitation
        ? String(invitation.temporaryPassword)
        : '';
    secrets.push(temporary);
    const marie = await newApp();
    await marie
      .state()
      .chooseInitialPassword(
        server.url,
        MARIE,
        temporary,
        PASSWORD,
        PASSWORD,
        DEVICE_NAMES[0] ?? '',
      );

    // Failed sign-ins, a wrong temporary password, a wrong current password.
    const stranger = await newApp();
    await stranger
      .state()
      .signIn(server.url, MARIE, WRONG_PASSWORD, 'Intruder');
    await stranger
      .state()
      .signIn(server.url, 'nobody@example.org', PASSWORD, 'Intruder');

    // Password change, then a reset request, a mail failure on each path.
    await marie.state().changePassword(PASSWORD, NEW_PASSWORD, NEW_PASSWORD);
    await marie
      .state()
      .changePassword(WRONG_PASSWORD, NEW_PASSWORD, NEW_PASSWORD);
    await requestAndWait(() =>
      stranger.state().requestPasswordReset(server.url, MARIE),
    );
    server.failMails(true);
    await requestAndWait(() =>
      stranger.state().requestPasswordReset(server.url, MARIE),
    );
    await adminApp.state().inviteAccount(PAUL);

    // A failed resend of credentials, then a deletion by the administrator.
    server.failMails(false);
    await adminApp.state().inviteAccount(LUCIE);
    const accounts = await adminApp.state().listAccounts();
    if (!accounts.ok) throw new Error('no accounts');
    const idOf = (email: string) =>
      accounts.value.find((a) => a.email === email)?.id ?? '';
    server.failMails(true);
    await adminApp.state().resendCredentials(idOf(LUCIE));
    server.failMails(false);
    await adminApp.state().suspendAccount(idOf(MARIE));
    await adminApp.state().deleteAccountAsAdmin(idOf(MARIE));

    for (const mail of server.mails()) {
      if ('temporaryPassword' in mail)
        secrets.push(String(mail.temporaryPassword));
    }
    return { apps: [adminApp, marie, stranger] as App[] };
  };

  const personalData = () => [
    ADMIN_EMAIL,
    MARIE,
    PAUL,
    LUCIE,
    'marie',
    'paul',
    'lucie',
    'example.org',
    PASSWORD,
    NEW_PASSWORD,
    WRONG_PASSWORD,
    ...DEVICE_NAMES,
    'Intruder',
    server.url,
    '127.0.0.1',
    'courses.test',
    ...secrets.filter((secret) => secret !== ''),
  ];

  it('004 SC-008 no log line and no server report holds an address, a password, a credential, a device name or a network address', async () => {
    await scenario();

    const text = [...logLines, serialize(server.reports())].join('\n');
    expect(logLines.length).toBeGreaterThan(0);
    for (const secret of personalData()) {
      expect({
        secret,
        found: text.toLowerCase().includes(secret.toLowerCase()),
      }).toEqual({ secret, found: false });
    }
  });

  it('004 SC-008 the app reports hold only the listed contexts and no personal data', async () => {
    const { apps } = await scenario();

    const reports = apps.flatMap((app) => app.reporter.reports);
    for (const { context } of reports) {
      expect(APP_OPERATIONS).toContain(context.operation);
      if (context.screen !== undefined) {
        expect(APP_SCREENS).toContain(context.screen);
      }
    }
    const text = serialize(reports);
    for (const secret of personalData()) {
      expect({
        secret,
        found: text.toLowerCase().includes(secret.toLowerCase()),
      }).toEqual({ secret, found: false });
    }
  });

  it('004 SC-008 normal refusals create no report', async () => {
    const wrongPassword = await newApp();
    await wrongPassword
      .state()
      .signIn(server.url, 'ghost@example.org', PASSWORD, 'Pixel');
    const account = await server.invite(MARIE);
    const expired = await newApp();
    clock.advance(8 * 24 * 60 * 60 * 1000);
    await expired
      .state()
      .chooseInitialPassword(
        server.url,
        MARIE,
        account.temporaryPassword,
        PASSWORD,
        PASSWORD,
        'Pixel',
      );
    await server.suspend(account.accountId);
    const suspended = await newApp();
    await suspended.state().signIn(server.url, MARIE, PASSWORD, 'Pixel');
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await wrongPassword
        .state()
        .signIn(server.url, 'ghost@example.org', WRONG_PASSWORD, 'Pixel');
    }
    const gone = await server.createAccount({ email: 'gone@example.org' });
    await server.suspend(gone.accountId);

    expect(server.reports()).toEqual([]);
    for (const app of [wrongPassword, expired, suspended]) {
      expect(app.reporter.reports).toEqual([]);
    }
  });
});
