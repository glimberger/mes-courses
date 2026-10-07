import type { IdGenerator } from '../ports/id-generator';

/** Predictable ids for tests: "id-1", "id-2", … */
export class SequentialIdGenerator implements IdGenerator {
  private last = 0;

  next(): string {
    this.last += 1;
    return `id-${this.last}`;
  }
}
