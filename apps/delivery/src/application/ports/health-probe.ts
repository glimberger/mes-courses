export type HealthResult = 'healthy' | 'wrong-commit' | 'unavailable';

export interface HealthProbe {
  /**
   * Polls `GET /v1/health` on `port` until `release.commit` equals `commit` or `timeoutMs` has
   * passed. The result of the last attempt tells why it did not succeed.
   */
  waitForCommit(
    port: number,
    commit: string,
    timeoutMs: number,
  ): Promise<HealthResult>;
}
