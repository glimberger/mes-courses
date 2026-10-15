export interface RunHistory {
  /** The names of the workflows with a successful run on `commit`. */
  successfulWorkflows(commit: string): Promise<string[]>;
}
