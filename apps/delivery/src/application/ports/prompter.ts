export interface Prompter {
  ask(question: string): Promise<string>;
  /** True for y or yes, false for anything else. */
  confirm(question: string): Promise<boolean>;
}
