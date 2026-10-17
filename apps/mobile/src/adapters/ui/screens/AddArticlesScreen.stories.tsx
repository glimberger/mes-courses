import type { Meta, StoryObj } from '@storybook/react-native';

import { fixture } from '../testing/fixtures';
import type { StoryScenario } from '../testing/story-store';
import { AddArticlesScreen } from './AddArticlesScreen';

const meta = {
  title: 'Screens/AddArticles',
  component: AddArticlesScreen,
} satisfies Meta<typeof AddArticlesScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  parameters: { scenario: { seed: fixture, pending: ['getCatalog'] } },
};

const LoadFailed: Story = {
  parameters: { scenario: { seed: fixture, failing: ['getCatalog'] } },
};

// Exported under the state's name without hiding the global `Error` in this file.
export { LoadFailed as Error };

/**
 * Mockup 3: categories with articles on the list ("Pommes", "Lait"), an addable one ("Beurre"), a
 * long name, and an empty category.
 */
export const NoQuery: Story = {
  parameters: { scenario: { seed: fixture } },
};

/** The catalog loaded, then searched as the user types. */
const searching =
  (query: string): StoryScenario['prepare'] =>
  async (store) => {
    await store.loadCatalog();
    store.searchCatalog(query);
  };

/** "pom" finds "Pommes", already on the list. */
export const SearchMatches: Story = {
  parameters: {
    scenario: {
      seed: fixture,
      prepare: searching('pom'),
    },
  },
};

export const SearchNoMatch: Story = {
  parameters: {
    scenario: {
      seed: fixture,
      prepare: searching('xyz'),
    },
  },
};

/** A long article name wraps in the matches list without clipping. */
export const SearchWrapped: Story = {
  parameters: {
    scenario: {
      seed: fixture,
      prepare: searching('yaourt'),
    },
  },
};
