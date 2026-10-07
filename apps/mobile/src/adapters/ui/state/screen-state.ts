/**
 * The state of one data region (Principle IX, specs/002-manage-articles/contracts/ui-state.md).
 * `idle` means never requested: nothing is rendered from it.
 */
export type ScreenState<T, E = never> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'empty'; detail: E }
  | { status: 'success'; data: T };
