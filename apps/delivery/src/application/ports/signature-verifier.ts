export interface SignatureVerifier {
  /** True when `signature` is a valid signature of `content` by an allowed signer. */
  verify(content: string, signature: string): Promise<boolean>;
}
