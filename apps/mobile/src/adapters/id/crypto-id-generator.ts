import { randomUUID } from 'expo-crypto';

import type { IdGenerator } from '../../application/ports/id-generator';

/** Random UUIDs from the platform's secure generator. */
export class CryptoIdGenerator implements IdGenerator {
  next(): string {
    return randomUUID();
  }
}
