import type { TestAppStack } from '@mes-courses/mobile/testing';
import type { TestServer } from '@mes-courses/server/testing';

export const PASSWORD = 'a long enough password';
export const EMAIL = 'marie@example.org';

const known = new WeakMap<TestServer, Set<string>>();

/**
 * Signs a device in to the server's account `email`. The first device of an address goes through
 * the invitation (temporary password, then its own password); the next ones sign in with it.
 * Returns the outcome of the use case so a test can check it.
 */
export const signInDevice = async (
  server: TestServer,
  stack: TestAppStack,
  deviceName: string,
  email = EMAIL,
) => {
  const emails = known.get(server) ?? new Set<string>();
  known.set(server, emails);
  if (!emails.has(email)) {
    emails.add(email);
    const { temporaryPassword } = await server.invite(email);
    return stack.useCases.chooseInitialPassword(
      server.url,
      email,
      temporaryPassword,
      PASSWORD,
      PASSWORD,
      deviceName,
    );
  }
  return stack.useCases.signIn(server.url, email, PASSWORD, deviceName);
};
