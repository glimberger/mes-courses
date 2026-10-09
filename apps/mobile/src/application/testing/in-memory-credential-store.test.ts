import { InMemoryCredentialStore } from './in-memory-credential-store';

describe('InMemoryCredentialStore', () => {
  it('holds nothing at first, then what was written, then nothing once cleared', async () => {
    const store = new InMemoryCredentialStore();
    expect(await store.read()).toBeNull();

    await store.write('secret');
    expect(await store.read()).toBe('secret');

    await store.clear();
    expect(await store.read()).toBeNull();
  });
});
