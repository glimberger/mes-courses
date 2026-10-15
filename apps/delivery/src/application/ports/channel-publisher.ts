import type { Environment } from '../../domain/manifest';

/** CI's side of a channel. The caller keeps the order: assets, then signature, then manifest. */
export interface ChannelPublisher {
  uploadAsset(environment: Environment, file: string): Promise<void>;
  uploadSignature(environment: Environment, signature: string): Promise<void>;
  uploadManifest(environment: Environment, manifest: string): Promise<void>;
  /** Deletes the assets of the channel that are not in `referenced`. */
  prune(environment: Environment, referenced: string[]): Promise<void>;
}
