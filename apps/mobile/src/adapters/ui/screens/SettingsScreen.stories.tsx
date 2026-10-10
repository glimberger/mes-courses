import type { Meta, StoryObj } from '@storybook/react-native';

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

/** Connected, with "Dernière synchronisation : …" (US4-8). */
export const Connected: Story = {
  parameters: {
    scenario: {
      seed: fixture,
      connected: {
        serverUrl: 'https://courses.example.fr',
        lastSyncAt: new Date(Date.now() - 5 * 60_000).toISOString(),
      },
    },
  },
};
