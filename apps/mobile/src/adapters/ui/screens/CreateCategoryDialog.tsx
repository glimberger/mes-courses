import type { CategoryId } from '../../../domain/category';
import {
  CreateNamedDialog,
  CreateNamedDialogForm,
  type CreateNamedDialogFormProps,
} from '../components/CreateNamedDialog';
import { useAppStore } from '../state/use-app-store';

export const NAME_ALREADY_USED = 'Cette catégorie existe déjà.';

export type CreateCategoryDialogProps = {
  visible: boolean;
  /**
   * Called once the dialog closes, with the new category's id, or null when nothing was created.
   * The screen that opened it chooses the category and moves screen reader focus back (FR-037).
   */
  onClose: (categoryId: CategoryId | null) => void;
};

/**
 * Creates a category after the existing ones (US4-2, FR-019). It opens empty each time.
 */
export const CreateCategoryDialog = ({
  visible,
  onClose,
}: CreateCategoryDialogProps) => {
  const createCategory = useAppStore((state) => state.createCategory);
  return (
    visible && (
      <CreateNamedDialog
        title="Nouvelle catégorie"
        alreadyUsedText={NAME_ALREADY_USED}
        create={createCategory}
        onClose={(created) => onClose(created?.categoryId ?? null)}
      />
    )
  );
};

/** The dialog as drawn, for a story to show the name error (T058). */
export const CreateCategoryDialogForm = (
  props: Omit<CreateNamedDialogFormProps, 'title'>,
) => <CreateNamedDialogForm title="Nouvelle catégorie" {...props} />;
