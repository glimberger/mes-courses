import { useEffect, useRef, useState } from 'react';
import { type HostInstance } from 'react-native';
import { RadioButton } from 'react-native-paper';

import type { CategoryId } from '../../../domain/category';
import { focusOn } from '../accessibility/focus';
import { CreateCategoryDialog } from '../screens/CreateCategoryDialog';
import { useAppStore } from '../state/use-app-store';
import { Button } from './Button';
import { paperRef } from './paper-ref';
import { RadioItem } from './RadioItem';
import { ScreenStateView } from './ScreenStateView';

export type CategoryPickerProps = {
  value: CategoryId | null;
  onChange: (id: CategoryId) => void;
  /** Disables "Nouvelle catégorie", for a form being saved. */
  disabled?: boolean;
};

/**
 * The categories as radio buttons, by position, loaded when it is drawn (US2-7, US4-1), then
 * "Nouvelle catégorie", which opens CreateCategoryDialog and chooses the category created
 * (US4-2, 002 US3-4). Screen reader focus goes back to the button when the dialog closes (FR-037).
 */
export const CategoryPicker = ({
  value,
  onChange,
  disabled = false,
}: CategoryPickerProps) => {
  const categories = useAppStore((state) => state.categories);
  const loadCategories = useAppStore((state) => state.loadCategories);
  const [creating, setCreating] = useState(false);
  const newCategoryRef = useRef<HostInstance>(null);
  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const closeDialog = (created: CategoryId | null) => {
    setCreating(false);
    if (created) onChange(created);
    focusOn(newCategoryRef);
  };

  return (
    <>
      <ScreenStateView
        state={categories}
        errorMessage="Impossible de charger les catégories."
        onRetry={() => void loadCategories()}
        renderSuccess={(data) => (
          <>
            <RadioButton.Group
              value={value ?? ''}
              onValueChange={(id) => onChange(id as CategoryId)}
            >
              {data.map((category) => (
                <RadioItem
                  key={category.id}
                  label={category.name}
                  value={category.id}
                />
              ))}
            </RadioButton.Group>
            <Button
              ref={paperRef(newCategoryRef)}
              icon="plus"
              disabled={disabled}
              onPress={() => setCreating(true)}
            >
              Nouvelle catégorie
            </Button>
          </>
        )}
      />
      <CreateCategoryDialog visible={creating} onClose={closeDialog} />
    </>
  );
};
