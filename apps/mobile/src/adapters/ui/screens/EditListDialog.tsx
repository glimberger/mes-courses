import { err, ok } from '../../../domain/result';
import type { ListId } from '../../../domain/shopping-list';
import {
  CreateNamedDialog,
  CreateNamedDialogForm,
  type CreateNamedDialogFormProps,
} from '../components/CreateNamedDialog';
import { useAppStore } from '../state/use-app-store';
import { useRemoteRemoval } from '../state/use-remote-removal';
import { NAME_ALREADY_USED } from './CreateListDialog';

/** What the dialog edits: the list as it was when the menu opened. */
export type EditedList = { id: ListId; name: string };

export type EditListDialogProps = {
  /** The list to rename; the dialog is open while it is set. */
  list: EditedList | null;
  /**
   * Called once the dialog closes, renamed or not. The screen that opened it moves screen reader
   * focus back (FR-037).
   */
  onClose: () => void;
};

const TITLE = 'Modifier la liste';
const CONFIRM = 'Enregistrer';

/**
 * Renames a list from the Listes tab (spec 012, US1). Mounted only while open, so the field
 * starts from the list's name each time. A refused name stays in the field with its error; a
 * failed save is told by the snackbar and the dialog stays open as typed. A list gone meanwhile,
 * here or through a pull, closes the dialog without a message.
 */
export const EditListDialog = ({ list, onClose }: EditListDialogProps) =>
  list === null ? null : <OpenEditListDialog list={list} onClose={onClose} />;

const OpenEditListDialog = ({
  list,
  onClose,
}: Omit<EditListDialogProps, 'list'> & { list: EditedList }) => {
  const renameList = useAppStore((state) => state.renameList);
  useRemoteRemoval({ listId: list.id }, () => onClose());

  return (
    <CreateNamedDialog
      title={TITLE}
      confirmLabel={CONFIRM}
      initialName={list.name}
      alreadyUsedText={NAME_ALREADY_USED}
      create={async (name) => {
        const outcome = await renameList(list.id, name);
        if (outcome.ok) return outcome;
        // A list that vanished is nothing to fix: the dialog closes.
        return outcome.error.type === 'ListNotFound'
          ? ok(undefined)
          : err(outcome.error);
      }}
      onClose={() => onClose()}
    />
  );
};

/** The dialog as drawn, for a story to show the name error. */
export const EditListDialogForm = (
  props: Omit<CreateNamedDialogFormProps, 'title' | 'confirmLabel'>,
) => <CreateNamedDialogForm title={TITLE} confirmLabel={CONFIRM} {...props} />;
