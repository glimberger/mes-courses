/**
 * What every in-memory double shares: the calls it received, in order, in one log that tests can
 * compare across doubles, and failures scripted by method name.
 */
export class Recorder {
  readonly calls: string[] = [];
  private readonly failures = new Map<string, Error[]>();

  /** The next call of `method` (for example `ServiceManager.stop`) throws `error`. */
  failNext(method: string, error: Error = new Error(`${method} failed`)): void {
    this.failures.set(method, [...(this.failures.get(method) ?? []), error]);
  }

  record(method: string, ...args: unknown[]): void {
    this.calls.push(
      [method, ...args.map((arg) => String(arg))].join(' ').trim(),
    );
    const error = this.failures.get(method)?.shift();
    if (error) throw error;
  }
}
