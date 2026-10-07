import { randomUUID } from 'expo-crypto';

import { CryptoIdGenerator } from './crypto-id-generator';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));

describe('CryptoIdGenerator', () => {
  it('returns a new random UUID on each call', () => {
    jest
      .mocked(randomUUID)
      .mockReturnValueOnce('0b6e2d8c-6f1e-4c55-9d3a-2f5a7c1e9b40')
      .mockReturnValueOnce('5d0c4a71-3e2b-4f8d-a6c9-81b7e4f2d053');
    const ids = new CryptoIdGenerator();

    expect(ids.next()).toBe('0b6e2d8c-6f1e-4c55-9d3a-2f5a7c1e9b40');
    expect(ids.next()).toBe('5d0c4a71-3e2b-4f8d-a6c9-81b7e4f2d053');
  });
});
