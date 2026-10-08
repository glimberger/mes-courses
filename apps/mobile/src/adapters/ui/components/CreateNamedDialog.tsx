import { useEffect, useRef, useState, type Ref } from 'react';
import { View, type HostInstance } from 'react-native';
import { Dialog, Portal } from 'react-native-paper';

import type { NameAlreadyUsed, NameError } from '../../../domain/name';
import { validateName } from '../../../domain/name';
import type { Result } from '../../../domain/result';
import { focusOn } from '../accessibility/focus';
import type { WriteFailed } from '../state/store-kit';
import { Button } from './Button';
import { nameErrorText, NameField } from './NameField';

/** What creating a named entity returns: the store actions' results, whatever the entity. */
export type CreateNamedResult<T> = Result<
  T,
  NameError | NameAlreadyUsed<unknown> | WriteFailed
>;

export type CreateNamedDialogProps<T> = {
  /** The dialog's title, which takes screen reader focus when it opens (FR-037). */
  title: string;
  /** Shown when another entity already has the name (FR-021). */
  alreadyUsedText: string;
  /** The store action that creates the entity. */
  create: (name: string) => Promise<CreateNamedResult<T>>;
  /**
   * Called once the dialog closes, with what was created, or null when nothing was. The screen
   * that opened it moves screen reader focus back (FR-037).
   */
  onClose: (created: T | null) => void;
};

/**
 * Asks for the name of a new list or category. The name is checked by the domain before anything
 * is saved (FR-022); a failed save keeps the dialog open, as typed: the snackbar says so. Mount it
 * only while it is open, so it opens empty each time.
 */
export const CreateNamedDialog = <T,>({
  title,
  alreadyUsedText,
  create,
  onClose,
}: CreateNamedDialogProps<T>) => {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Set at once, so a second tap before the next render does not create a second entity.
  const savingRef = useRef(false);
  const titleRef = useRef<HostInstance>(null);

  // Screen reader focus goes to the title when the dialog opens (FR-037).
  useEffect(() => {
    focusOn(titleRef);
  }, []);

  const submit = async () => {
    if (savingRef.current) return;
    const validated = validateName(name);
    if (!validated.ok) {
      setError(nameErrorText(validated.error));
      return;
    }
    setError(null);
    savingRef.current = true;
    setSaving(true);
    const outcome = await create(name);
    savingRef.current = false;
    setSaving(false);
    if (outcome.ok) {
      onClose(outcome.value);
      return;
    }
    switch (outcome.error.type) {
      case 'NameAlreadyUsed':
        setError(alreadyUsedText);
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
    <CreateNamedDialogForm
      title={title}
      titleRef={titleRef}
      name={name}
      onChangeName={setName}
      error={error}
      saving={saving}
      onClose={() => onClose(null)}
      onSubmit={() => void submit()}
    />
  );
};

export type CreateNamedDialogFormProps = {
  title: string;
  /** The title, which takes screen reader focus when the dialog opens (FR-037). */
  titleRef?: Ref<HostInstance> | undefined;
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
export const CreateNamedDialogForm = ({
  title,
  titleRef,
  name,
  onChangeName,
  error,
  saving,
  onClose,
  onSubmit,
}: CreateNamedDialogFormProps) => (
  <Portal>
    {/* Not closed while saving, so the outcome of the save is always shown. */}
    <Dialog
      visible
      dismissable={!saving}
      onDismiss={onClose}
      overlayAccessibilityLabel="Fermer la boîte de dialogue"
    >
      {/* The title read as one header, and the target of the focus move. */}
      <View ref={titleRef} accessible accessibilityRole="header">
        <Dialog.Title>{title}</Dialog.Title>
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
