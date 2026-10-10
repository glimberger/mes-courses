import type { Meta, StoryObj } from '@storybook/react-native';

import { ok } from '../../../domain/result';
import { fixture } from '../testing/fixtures';
import { SettingsScreen } from './SettingsScreen';

const meta = {
  title: 'Screens/Settings',
  component: SettingsScreen,
} satisfies Meta<typeof SettingsScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A device that never was connected: the explanation and "Connecter à un serveur" (US4-1). */
export const NotConnected: Story = {
  parameters: { scenario: { seed: fixture } },
};

const connected = {
  serverUrl: 'https://courses.example.fr',
  lastSyncAt: new Date(Date.now() - 5 * 60_000).toISOString(),
};

/** Connected, with "Dernière synchronisation : …" and the device list, this one marked (US4-8). */
export const Connected: Story = {
  parameters: {
    scenario: {
      seed: fixture,
      connected,
      syncServer: {
        listDevices: async () =>
          ok([
            {
              id: 'story-device',
              name: 'Pixel de Léa',
              createdAt: '2026-09-01T10:00:00.000Z',
              lastSyncAt: connected.lastSyncAt,
            },
            {
              id: 'device-2',
              name: 'iPhone de Marc',
              createdAt: '2026-09-02T10:00:00.000Z',
              lastSyncAt: '2026-09-30T08:00:00.000Z',
            },
          ]),
      },
    },
  },
};

/** The device list is loading. */
export const DevicesLoading: Story = {
  parameters: {
    scenario: { seed: fixture, connected, pending: ['listDevices'] },
  },
};

/** The device list failed to load: "Réessayer". */
export const DevicesError: Story = {
  parameters: {
    scenario: { seed: fixture, connected, failing: ['listDevices'] },
  },
};

/** The server cannot be reached: said without error colors. */
export const DevicesOffline: Story = {
  parameters: { scenario: { seed: fixture, connected } },
};
