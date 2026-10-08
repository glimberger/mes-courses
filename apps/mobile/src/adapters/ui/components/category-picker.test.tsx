import { useState } from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { CategoryId } from '../../../domain/category';
import { fixture } from '../testing/fixtures';
import { renderWithStore } from '../testing/render-with-store';
import { CategoryPicker } from './CategoryPicker';

// "Fruits et légumes" and "Boucherie et poissonnerie", the first two categories of the fixture.
const first = { id: 'category-0' as CategoryId, name: 'Fruits et légumes' };
const second = {
  id: 'category-1' as CategoryId,
  name: 'Boucherie et poissonnerie',
};

/** The picker alone, holding its own selection as a form would. */
const Harness = ({ initial = null }: { initial?: CategoryId | null }) => {
  const [value, setValue] = useState<CategoryId | null>(initial);
  return <CategoryPicker value={value} onChange={setValue} />;
};

const renderPicker = async (initial?: CategoryId | null) => {
  const rendered = await renderWithStore(
    <Harness initial={initial ?? null} />,
    {
      seed: fixture,
    },
  );
  await screen.findByRole('radio', { name: first.name });
  return rendered;
};

describe('CategoryPicker', () => {
  it('002 US3-1 lists the categories by position, then "Nouvelle catégorie"', async () => {
    await renderPicker();

    const labels = screen
      .getAllByRole('radio')
      .map((radio) => radio.props.accessibilityLabel as string | undefined)
      .filter((label) => label !== undefined);
    expect(labels).toEqual(
      [...fixture.categories]
        .sort((a, b) => a.position - b.position)
        .map((category) => category.name),
    );
    expect(
      screen.getByRole('button', { name: 'Nouvelle catégorie' }),
    ).toBeOnTheScreen();
  });

  it('002 US3-1 checks the given category only', async () => {
    await renderPicker(second.id);

    expect(screen.getByRole('radio', { name: second.name })).toBeChecked();
    expect(screen.getByRole('radio', { name: first.name })).not.toBeChecked();
  });

  it('002 US3-2 chooses another category when tapped', async () => {
    await renderPicker(first.id);

    fireEvent.press(screen.getByRole('radio', { name: second.name }));

    expect(screen.getByRole('radio', { name: second.name })).toBeChecked();
    expect(screen.getByRole('radio', { name: first.name })).not.toBeChecked();
  });

  it('002 US3-4 preselects the category just created from "Nouvelle catégorie"', async () => {
    await renderPicker(first.id);

    fireEvent.press(screen.getByRole('button', { name: 'Nouvelle catégorie' }));
    await waitFor(() =>
      expect(screen.getAllByLabelText('Nom')).toHaveLength(1),
    );
    fireEvent.changeText(screen.getByLabelText('Nom'), 'Bébé');
    fireEvent.press(screen.getByRole('button', { name: 'Créer' }));

    expect(await screen.findByRole('radio', { name: 'Bébé' })).toBeChecked();
    expect(screen.getByRole('radio', { name: first.name })).not.toBeChecked();
  });

  it('002 US3-4 keeps the selection when the dialog is dismissed without creating', async () => {
    await renderPicker(first.id);

    fireEvent.press(screen.getByRole('button', { name: 'Nouvelle catégorie' }));
    fireEvent.press(await screen.findByRole('button', { name: 'Annuler' }));

    await waitFor(() =>
      expect(screen.queryByLabelText('Nom')).not.toBeOnTheScreen(),
    );
    expect(screen.getByRole('radio', { name: first.name })).toBeChecked();
  });
});
