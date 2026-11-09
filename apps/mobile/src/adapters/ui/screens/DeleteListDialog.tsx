import { useEffect, useRef } from 'react';
import type { HostInstance } from 'react-native';

import type { ListId } from '../../../domain/shopping-list';
import { focusOn } from '../accessibility/focus';
import { AppDialog } from '../components/AppDialog';
import { useAppStore } from '../state/use-app-store';
import { useRemoteRemoval } from '../state/use-remote-removal';

/** What the dialog deletes: the list as it was when the menu opened. */
export type DeletedListTarget = { id: ListId; name: string };

export type DeleteListDialogProps = {
  /** The list to delete; the dialog is open while it is set. */
  list: DeletedListTarget | null;
  /**
   * Called once the dialog closes, deleted or not. The screen that opened it moves screen reader
   * focus back (FR-037).
   */
  onClose: () => void;
};

/**
 * Asks before deleting a list and its items (spec 012, US2, mockup 28). There is no undo offer.
 * A failed save shows its own notice and the dialog closes; a list gone meanwhile, here or
 * through a pull, closes it without a message. Screen reader focus goes to its title when it
 * opens.
 */
export const DeleteListDialog = ({ list, onClose }: DeleteListDialogProps) =>
  list === null ? null : <OpenDeleteListDialog list={list} onClose={onClose} />;

const OpenDeleteListDialog = ({
  list,
  onClose,
}: Omit<DeleteListDialogProps, 'list'> & { list: DeletedListTarget }) => {
  const deleteList = useAppStore((state) => state.deleteList);
  const titleRef = useRef<HostInstance>(null);
  // A second tap on "Supprimer" must not delete, or close, twice.
  const deleting = useRef(false);
  useEffect(() => {
    focusOn(titleRef);
  }, []);
  useRemoteRemoval({ listId: list.id }, () => {
    if (!deleting.current) onClose();
  });

  const confirm = async () => {
    if (deleting.current) return;
    deleting.current = true;
    // A failed save shows its own notice, a vanished list none; either way the dialog closes.
    await deleteList(list.id);
    onClose();
  };

  return (
    <AppDialog
      visible
      onDismiss={onClose}
      icon="delete"
      iconTone="error"
      layout="centered"
      title={`Supprimer « ${list.name} » ?`}
      titleRef={titleRef}
      message="La liste et ses articles seront supprimés. Les articles restent dans le catalogue."
      cancel={{ label: 'Annuler', onPress: onClose }}
      confirm={{
        label: 'Supprimer',
        onPress: () => void confirm(),
        mode: 'dangerFilled',
      }}
    />
  );
};
