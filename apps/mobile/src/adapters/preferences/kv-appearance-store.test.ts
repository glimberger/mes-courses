import Storage from 'expo-sqlite/kv-store';

import { KvAppearanceStore } from './kv-appearance-store';

jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: { getItemSync: jest.fn(), setItemSync: jest.fn() },
}));

describe('KvAppearanceStore', () => {
  beforeEach(() => jest.resetAllMocks());

  it('reads back a stored setting', () => {
    jest.mocked(Storage.getItemSync).mockReturnValue('dark');

    expect(new KvAppearanceStore().read()).toBe('dark');
  });

  it.each([null, 'sepia'])('falls back to system for %p', (stored) => {
    jest.mocked(Storage.getItemSync).mockReturnValue(stored);

    expect(new KvAppearanceStore().read()).toBe('system');
  });

  it('falls back to system when the store cannot be read', () => {
    jest.mocked(Storage.getItemSync).mockImplementation(() => {
      throw new Error('unreadable');
    });

    expect(new KvAppearanceStore().read()).toBe('system');
  });

  it('writes the setting', () => {
    new KvAppearanceStore().write('light');

    expect(Storage.setItemSync).toHaveBeenCalledWith(
      expect.any(String),
      'light',
    );
  });

  it('does not throw when the setting cannot be written', () => {
    jest.mocked(Storage.setItemSync).mockImplementation(() => {
      throw new Error('full');
    });

    expect(() => new KvAppearanceStore().write('light')).not.toThrow();
  });
});
