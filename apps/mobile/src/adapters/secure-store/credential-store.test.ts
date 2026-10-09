import * as SecureStore from 'expo-secure-store';

import { SecureStoreCredentialStore } from './credential-store';

jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'when-unlocked-this-device-only',
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

describe('SecureStoreCredentialStore', () => {
  beforeEach(() => jest.resetAllMocks());

  it('003 writes with the WHEN_UNLOCKED_THIS_DEVICE_ONLY accessibility option', async () => {
    await new SecureStoreCredentialStore().write('secret');

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      expect.any(String),
      'secret',
      { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
    );
  });

  it('reads back the stored credential', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue('secret');

    expect(await new SecureStoreCredentialStore().read()).toBe('secret');
  });

  it('reads null when nothing is stored', async () => {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValue(null);

    expect(await new SecureStoreCredentialStore().read()).toBeNull();
  });

  it('003 R12a reads null when the module throws while decrypting a restored value', async () => {
    jest
      .mocked(SecureStore.getItemAsync)
      .mockRejectedValue(new Error('Could not decrypt the value'));

    expect(await new SecureStoreCredentialStore().read()).toBeNull();
  });

  it('clears the stored credential', async () => {
    await new SecureStoreCredentialStore().clear();

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledTimes(1);
  });

  it('uses the same entry for write, read and clear', async () => {
    const store = new SecureStoreCredentialStore();
    await store.write('secret');
    await store.read();
    await store.clear();

    const keys = [
      jest.mocked(SecureStore.setItemAsync).mock.calls[0]?.[0],
      jest.mocked(SecureStore.getItemAsync).mock.calls[0]?.[0],
      jest.mocked(SecureStore.deleteItemAsync).mock.calls[0]?.[0],
    ];
    expect(new Set(keys).size).toBe(1);
  });
});
