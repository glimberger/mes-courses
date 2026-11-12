/** A release of the delivery agent: the asset `delivery-<agentVersion>.tar.gz` of release `tag`. */
export type AgentRelease = {
  /** The release tag, `vX.Y.Z`. */
  tag: string;
  /** The agent's own version, from the asset name; it names the folder under `releases/`. */
  agentVersion: string;
  assetId: number;
  assetName: string;
};

/** Where the agent's releases are published. */
export interface AgentReleases {
  /** The release `version` (`X.Y.Z`), or the latest one when omitted. */
  resolve(version?: string): Promise<AgentRelease>;
}

/** The Pi, as far as the agent's installation is concerned. */
export interface AgentHost {
  /** The agent version `current` points at, null when there is none. */
  currentVersion(): Promise<string | null>;
  /** True when `releases/<version>` is completely installed. */
  isReady(version: string): Promise<boolean>;
  /** Downloads the bundle with the host's own read-only token and unpacks it; `current` stays. */
  install(release: AgentRelease): Promise<void>;
  /** Builds the Node runtime of the unpacked bundle, then marks the release ready. */
  buildRuntime(version: string): Promise<void>;
  /** Points `runtime` and `current` at the ready release. */
  activate(version: string): Promise<void>;
  /** The output of `main.js status`. */
  status(): Promise<string>;
}
