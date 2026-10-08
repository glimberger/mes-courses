import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-native';

import type { CategoryId } from '../../../domain/category';
import { fixture } from '../testing/fixtures';
import { CategoryPicker } from './CategoryPicker';

const meta = {
  title: 'Components/CategoryPicker',
  component: CategoryPicker,
  // Each story renders its own stateful picker.
  args: { value: null, onChange: () => undefined },
  parameters: { scenario: { seed: fixture } },
} satisfies Meta<typeof CategoryPicker>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Holds the selection as a form would, so a tap on a category chooses it. */
const Selectable = ({ initial }: { initial: CategoryId | null }) => {
  const [value, setValue] = useState(initial);
  return <CategoryPicker value={value} onChange={setValue} />;
};

/** The categories by position, the first one chosen. */
export const Default: Story = {
  render: () => <Selectable initial={fixture.categories[0]?.id ?? null} />,
};

const bebe = {
  id: 'category-bebe' as CategoryId,
  name: 'Bébé',
  position: fixture.categories.length,
};

/** "Bébé" just created through "Nouvelle catégorie": it is last, and chosen (002 US3-4). */
export const NewCategorySelected: Story = {
  parameters: {
    scenario: {
      seed: { ...fixture, categories: [...fixture.categories, bebe] },
    },
  },
  render: () => <Selectable initial={bebe.id} />,
};
