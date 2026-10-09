import type { CredentialStore } from '../ports/credential-store';

/** A credential store kept in memory, for use case and UI tests. */
export class InMemoryCredentialStore implements CredentialStore {
  constructor(private credential: string | null = null) {}

  async read(): Promise<string | null> {
    return this.credential;
  }

  async write(credential: string): Promise<void> {
    this.credential = credential;
  }

  async clear(): Promise<void> {
    this.credential = null;
  }
}
