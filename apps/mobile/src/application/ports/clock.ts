/** The wall clock, replaced by a fake in tests (constitution Principle III). */
export interface Clock {
  nowMs(): number;
}
