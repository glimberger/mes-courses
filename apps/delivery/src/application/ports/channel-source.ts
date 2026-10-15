import type { Environment } from '../../domain/manifest';

/** What GitHub answered, so a caller can tell `401`/`403` (token) from `404` (no channel yet). */
export class ChannelSourceError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ChannelSourceError';
  }
}

export type ChannelFiles = { manifest: string; signature: string };

export interface ChannelSource {
  /** The manifest and its signature, or null when the channel does not exist yet. */
  fetchChannel(environment: Environment): Promise<ChannelFiles | null>;
  /** Streams a release asset of the channel to `destination`. */
  downloadAsset(
    environment: Environment,
    asset: string,
    destination: string,
  ): Promise<void>;
}
