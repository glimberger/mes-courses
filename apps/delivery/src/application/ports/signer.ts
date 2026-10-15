export interface Signer {
  /** The detached signature of `content`, in the `mes-courses-deploy` namespace. */
  sign(content: string): Promise<string>;
}
