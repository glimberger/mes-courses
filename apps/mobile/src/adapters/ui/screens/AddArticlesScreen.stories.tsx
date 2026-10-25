import { useEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-native';

import { fixture } from '../testing/fixtures';
import { useAppStoreApi } from '../state/app-store-provider';
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
 * The screen once the user has added "Beurre" during the visit: "Pommes" and "Lait", on the list
 * when the screen opened, stay hidden, and "Beurre" stays shown, marked as added. The article is
 * added once the screen has taken its snapshot of the list.
 */
const AddedDuringVisit = () => {
  const store = useAppStoreApi();
  useEffect(() => {
    let done = false;
    const add = () => {
      const { full } = store.getState().catalog;
      if (done || full.status !== 'success') return;
      done = true;
      const beurre = full.data.sections
        .flatMap((section) => section.articles)
        .find((article) => article.name === 'Beurre');
      if (beurre === undefined) return;
      // After the screen's own load resolved, so the article is not in its snapshot.
      setTimeout(() => {
        void store
          .getState()
          .addArticleToList({ id: beurre.id, name: beurre.name }, null);
      }, 0);
    };
    add();
    return store.subscribe(add);
  }, [store]);
  return <AddArticlesScreen />;
};

/** Mockup 3: categories, an article added during the visit ("Beurre"), a long name, an empty category. */
export const NoQuery: Story = {
  render: () => <AddedDuringVisit />,
  parameters: { scenario: { seed: fixture } },
};

/** No article in the catalog: every category offers its creation card. */
export const Empty: Story = {
  parameters: {
    scenario: { seed: { ...fixture, articles: [], items: [] } },
  },
};

/** "beu" finds "Beurre", which can be added. */
export const SearchMatches: Story = {
  render: () => <AddArticlesScreen initialQuery="beu" />,
  parameters: { scenario: { seed: fixture } },
};

/** "pom" finds "Pommes", on the list when the screen opened: said so, with no action. */
export const SearchHiddenMatch: Story = {
  render: () => <AddArticlesScreen initialQuery="pom" />,
  parameters: { scenario: { seed: fixture } },
};

export const SearchNoMatch: Story = {
  render: () => <AddArticlesScreen initialQuery="xyz" />,
  parameters: { scenario: { seed: fixture } },
};

/** A long article name wraps in the matches list without clipping. */
export const SearchWrapped: Story = {
  render: () => <AddArticlesScreen initialQuery="yaourt" />,
  parameters: { scenario: { seed: fixture } },
};
