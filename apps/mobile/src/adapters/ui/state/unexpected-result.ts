/**
 * A `Result` error that no input of the user can cause (a missing record, the wrong state),
 * reported in place of the result. It carries only the result's tag, never its other fields
 * (FR-030, 001 contracts/driving-ports.md).
 */
export class UnexpectedResult extends Error {
  constructor(readonly code: string) {
    super('Unexpected use case result');
    this.name = 'UnexpectedResult';
  }
}
