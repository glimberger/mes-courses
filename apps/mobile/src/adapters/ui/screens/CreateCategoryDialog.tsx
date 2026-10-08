import { useEffect, useRef, useState, type Ref } from 'react';
import { View } from 'react-native';
import { Button, Dialog, Portal } from 'react-native-paper';

import type { CategoryId } from '../../../domain/category';
import { validateName } from '../../../domain/name';
import { focusOn } from '../accessibility/focus';
import { nameErrorText, NameField } from '../components/NameField';
import { useAppStore } from '../state/use-app-store';

const NAME_ALREADY_USED = 'Cette catégorie existe déjà.';

export type CreateCategoryDialogProps = {
  visible: boolean;
  /**
   * Called once the dialog closes, with the new category's id, or null when nothing was created.
   * The screen that opened it chooses the category and moves screen reader focus back (FR-037).
   */
  onClose: (categoryId: CategoryId | null) => void;
};

/**
 * Creates a category after the existing ones (US4-2, FR-019). The name is checked by the domain
 * before anything is saved (FR-022); a failed save keeps the dialog open, as typed: the snackbar
 * says so. It opens empty each time.
 */
export const CreateCategoryDialog = ({
  visible,
  onClose,
}: CreateCategoryDialogProps) =>
  visible && <CreateCategoryForm onClose={onClose} />;

const CreateCategoryForm = ({
  onClose,
}: {
  onClose: (categoryId: CategoryId | null) => void;
}) => {
  const createCategory = useAppStore((state) => state.createCategory);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Set at once, so a second tap before the next render does not create a second category.
  const savingRef = useRef(false);
  const titleRef = useRef<View>(null);

  // Screen reader focus goes to the title when the dialog opens (FR-037).
  useEffect(() => {
    focusOn(titleRef);
  }, []);

  const create = async () => {
    if (savingRef.current) return;
    const validated = validateName(name);
    if (!validated.ok) {
      setError(nameErrorText(validated.error));
      return;
    }
    setError(null);
    savingRef.current = true;
    setSaving(true);
    const outcome = await createCategory(name);
    savingRef.current = false;
    setSaving(false);
    if (outcome.ok) {
      onClose(outcome.value.categoryId);
      return;
    }
    switch (outcome.error.type) {
      case 'NameAlreadyUsed':
        setError(NAME_ALREADY_USED);
        return;
      case 'NameRequired':
      case 'NameTooLong':
        setError(nameErrorText(outcome.error));
        return;
      case 'WriteFailed':
        return;
    }
  };

  return (
    <CreateCategoryDialogForm
      titleRef={titleRef}
      name={name}
      onChangeName={setName}
      error={error}
      saving={saving}
      onClose={() => onClose(null)}
      onSubmit={() => void create()}
    />
  );
};

export type CreateCategoryDialogFormProps = {
  /** The title, which takes screen reader focus when the dialog opens (FR-037). */
  titleRef?: Ref<View> | undefined;
  name: string;
  onChangeName: (text: string) => void;
  /** The French name error, if any. */
  error: string | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: () => void;
};

/**
 * The dialog as drawn, its values, errors and callbacks given as props, so a story can show the
 * name error (T058).
 */
export const CreateCategoryDialogForm = ({
  titleRef,
  name,
  onChangeName,
  error,
  saving,
  onClose,
  onSubmit,
}: CreateCategoryDialogFormProps) => (
  <Portal>
    {/* Not closed while saving, so the outcome of the save is always shown. */}
    <Dialog visible dismissable={!saving} onDismiss={onClose}>
      {/* The title read as one header, and the target of the focus move. */}
      <View ref={titleRef} accessible accessibilityRole="header">
        <Dialog.Title>Nouvelle catégorie</Dialog.Title>
      </View>
      <Dialog.Content>
        <NameField value={name} onChangeText={onChangeName} error={error} />
      </Dialog.Content>
      <Dialog.Actions>
        <Button disabled={saving} onPress={onClose}>
          Annuler
        </Button>
        <Button disabled={saving} onPress={onSubmit}>
          Créer
        </Button>
      </Dialog.Actions>
    </Dialog>
  </Portal>
);
