export interface SecretPrompter {
  /** Asks for a secret without echoing it; it is never logged or stored by the caller. */
  askSecret(question: string): Promise<string>;
}
