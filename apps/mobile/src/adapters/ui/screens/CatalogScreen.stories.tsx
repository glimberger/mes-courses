import type { Meta, StoryObj } from '@storybook/react-native';

import { fixture } from '../testing/fixtures';
import { CatalogScreen } from './CatalogScreen';

const meta = {
  title: 'Screens/Catalog',
  component: CatalogScreen,
  parameters: { scenario: { seed: fixture } },
} satisfies Meta<typeof CatalogScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Articles by category, a badge on "Pommes" and "Lait", the empty categories hidden. */
export const Default: Story = {};

export const DefaultDark: Story = {
  parameters: { scenario: { seed: fixture }, appearance: 'dark' },
};

/** "pom" finds "Pommes". */
export const Search: Story = { args: { initialQuery: 'pom' } };

export const Empty: Story = {
  parameters: {
    scenario: { seed: { ...fixture, articles: [], items: [] } },
  },
};

export const Loading: Story = {
  parameters: { scenario: { seed: fixture, pending: ['getCatalog'] } },
};

const LoadFailed: Story = {
  parameters: { scenario: { seed: fixture, failing: ['getCatalog'] } },
};

// Exported under the state's name without hiding the global `Error` in this file.
export { LoadFailed as Error };

/** The ⋮ menu of "Lait" open, with "Modifier" and "Supprimer". */
export const RowMenu: Story = { args: { menuInitiallyOpenFor: 'Lait' } };
