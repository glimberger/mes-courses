import * as SecureStore from 'expo-secure-store';

import type { CredentialStore } from '../../application/ports/credential-store';

const ENTRY_NAME = 'device-credential';

/**
 * The device credential in the operating system's secure storage. On iOS it is readable only while
 * the device is unlocked and never leaves this device; on Android the config plugin excludes it
 * from Auto Backup (research R12a).
 */
export class SecureStoreCredentialStore implements CredentialStore {
  async read(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(ENTRY_NAME);
    } catch {
      // A value restored without the means to decrypt it: the device is not connected (R12a).
      return null;
    }
  }

  async write(credential: string): Promise<void> {
    await SecureStore.setItemAsync(ENTRY_NAME, credential, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }

  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(ENTRY_NAME);
  }
}
