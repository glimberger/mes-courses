export interface Output {
  /** One line of the command's report (stdout). */
  line(text: string): void;
}
