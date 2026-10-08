import { useEffect, useRef, useState, type Ref } from 'react';
import { View } from 'react-native';
import { Button, Dialog, Portal } from 'react-native-paper';

import { validateName } from '../../../domain/name';
import { focusOn } from '../accessibility/focus';
import { nameErrorText, NameField } from '../components/NameField';
import { useAppStore } from '../state/use-app-store';

const NAME_ALREADY_USED = 'Une liste porte déjà ce nom.';

export type CreateListDialogProps = {
  visible: boolean;
  /**
   * Called once the dialog closes, created or not. The screen that opened it moves screen reader
   * focus back (FR-037).
   */
  onClose: () => void;
};

/**
 * Creates an empty list, not current (US3-2, FR-024). The name is checked by the domain before
 * anything is saved (FR-022); a failed save keeps the dialog open, as typed: the snackbar says so.
 * It opens empty each time.
 */
export const CreateListDialog = ({ visible, onClose }: CreateListDialogProps) =>
  visible && <CreateListForm onClose={onClose} />;

const CreateListForm = ({ onClose }: { onClose: () => void }) => {
  const createList = useAppStore((state) => state.createList);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const titleRef = useRef<View>(null);

  // Screen reader focus goes to the title when the dialog opens (FR-037).
  useEffect(() => {
    focusOn(titleRef);
  }, []);

  const create = async () => {
    const validated = validateName(name);
    if (!validated.ok) {
      setError(nameErrorText(validated.error));
      return;
    }
    setError(null);
    setSaving(true);
    const outcome = await createList(name);
    setSaving(false);
    if (outcome.ok) {
      onClose();
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
    <CreateListDialogForm
      titleRef={titleRef}
      name={name}
      onChangeName={setName}
      error={error}
      saving={saving}
      onClose={onClose}
      onSubmit={() => void create()}
    />
  );
};

export type CreateListDialogFormProps = {
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
export const CreateListDialogForm = ({
  titleRef,
  name,
  onChangeName,
  error,
  saving,
  onClose,
  onSubmit,
}: CreateListDialogFormProps) => (
  <Portal>
    <Dialog visible onDismiss={onClose}>
      {/* The title read as one header, and the target of the focus move. */}
      <View ref={titleRef} accessible accessibilityRole="header">
        <Dialog.Title>Nouvelle liste</Dialog.Title>
      </View>
      <Dialog.Content>
        <NameField value={name} onChangeText={onChangeName} error={error} />
      </Dialog.Content>
      <Dialog.Actions>
        <Button onPress={onClose}>Annuler</Button>
        <Button disabled={saving} onPress={onSubmit}>
          Créer
        </Button>
      </Dialog.Actions>
    </Dialog>
  </Portal>
);
