import {
  CreateNamedDialog,
  CreateNamedDialogForm,
  type CreateNamedDialogFormProps,
} from '../components/CreateNamedDialog';
import { useAppStore } from '../state/use-app-store';

export const NAME_ALREADY_USED = 'Une liste porte déjà ce nom.';

export type CreateListDialogProps = {
  visible: boolean;
  /**
   * Called once the dialog closes, created or not. The screen that opened it moves screen reader
   * focus back (FR-037).
   */
  onClose: () => void;
};

/**
 * Creates an empty list, not current (US3-2, FR-024). It opens empty each time.
 */
export const CreateListDialog = ({
  visible,
  onClose,
}: CreateListDialogProps) => {
  const createList = useAppStore((state) => state.createList);
  return (
    visible && (
      <CreateNamedDialog
        title="Nouvelle liste"
        alreadyUsedText={NAME_ALREADY_USED}
        create={createList}
        onClose={() => onClose()}
      />
    )
  );
};

/** The dialog as drawn, for a story to show the name error (T058). */
export const CreateListDialogForm = (
  props: Omit<CreateNamedDialogFormProps, 'title'>,
) => <CreateNamedDialogForm title="Nouvelle liste" {...props} />;
