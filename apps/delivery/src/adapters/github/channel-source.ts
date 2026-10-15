import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import {
  ChannelSourceError,
  type ChannelSource,
} from '../../application/ports/channel-source';

type Asset = { id: number; name: string };

export type GithubChannelSourceOptions = {
  /** `owner/name`. */
  repository: string;
  token: string;
  apiUrl?: string;
  /** Limit for one request, a download included. */
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 5 * 60_000;

/** Reads a channel (`channel-<env>` release) with the REST API and a read-only token. */
export const createGithubChannelSource = ({
  repository,
  token,
  apiUrl = 'https://api.github.com',
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: GithubChannelSourceOptions): ChannelSource => {
  const request = async (path: string, accept: string): Promise<Response> => {
    let response: Response;
    try {
      response = await fetch(`${apiUrl}/repos/${repository}/${path}`, {
        headers: {
          Accept: accept,
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      throw new ChannelSourceError(
        `GitHub request failed: ${(error as Error).message}`,
      );
    }
    return response;
  };

  const assetsOf = async (environment: string): Promise<Asset[] | null> => {
    const response = await request(
      `releases/tags/channel-${environment}`,
      'application/vnd.github+json',
    );
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new ChannelSourceError(
        `GitHub answered ${response.status} for channel-${environment}`,
        response.status,
      );
    }
    const body = (await response.json()) as { assets?: Asset[] };
    return body.assets ?? [];
  };

  const open = async (asset: Asset): Promise<Response> => {
    const response = await request(
      `releases/assets/${asset.id}`,
      'application/octet-stream',
    );
    if (!response.ok || response.body === null) {
      throw new ChannelSourceError(
        `GitHub answered ${response.status} for ${asset.name}`,
        response.status,
      );
    }
    return response;
  };

  const find = (assets: Asset[], name: string): Asset => {
    const asset = assets.find((candidate) => candidate.name === name);
    if (!asset) throw new ChannelSourceError(`The channel has no ${name}`);
    return asset;
  };

  return {
    async fetchChannel(environment) {
      const assets = await assetsOf(environment);
      if (assets === null) return null;
      const manifest = find(assets, 'manifest.json');
      const signature = find(assets, 'manifest.json.sig');
      const [manifestText, signatureText] = await Promise.all([
        open(manifest).then((response) => response.text()),
        open(signature).then((response) => response.text()),
      ]);
      return { manifest: manifestText, signature: signatureText };
    },

    async downloadAsset(environment, name, destination) {
      const assets = await assetsOf(environment);
      if (assets === null) {
        throw new ChannelSourceError(`No channel-${environment} release`, 404);
      }
      const response = await open(find(assets, name));
      try {
        await pipeline(
          Readable.fromWeb(
            response.body as import('node:stream/web').ReadableStream,
          ),
          createWriteStream(destination),
        );
      } catch (error) {
        throw new ChannelSourceError(
          `Download of ${name} failed: ${(error as Error).message}`,
        );
      }
    },
  };
};
