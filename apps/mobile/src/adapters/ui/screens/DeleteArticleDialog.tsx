import { useEffect, useRef } from 'react';
import type { HostInstance } from 'react-native';

import type { ArticleId } from '../../../domain/article';
import { focusOn } from '../accessibility/focus';
import { AppDialog } from '../components/AppDialog';
import { useAppStore } from '../state/use-app-store';

export type DeleteArticleDialogProps = {
  /** The article to delete; the dialog is open while it is set. */
  article: { id: ArticleId; name: string } | null;
  /** The number of lists holding the article. */
  count: number;
  onClose: () => void;
};

/** The texts of the contract (mockup 24): how many lists the article leaves. */
const consequence = (count: number): string => {
  if (count <= 0) return 'L’article n’est dans aucune liste.';
  return count === 1
    ? 'L’article sera retiré de 1 liste.'
    : `L’article sera retiré de ${count} listes.`;
};

/**
 * Asks before deleting an article, saying how many lists it will leave (FR-006, AC4). Screen reader
 * focus goes to its title when it opens (FR-037); the screen that opened it moves focus back
 * when it closes.
 */
export const DeleteArticleDialog = ({
  article,
  count,
  onClose,
}: DeleteArticleDialogProps) => {
  const deleteArticle = useAppStore((state) => state.deleteArticle);
  const titleRef = useRef<HostInstance>(null);
  // A second tap on "Supprimer" must not delete, or close, twice.
  const deleting = useRef(false);
  const visible = article !== null;
  useEffect(() => {
    if (visible) focusOn(titleRef);
  }, [visible]);

  const confirm = async () => {
    if (article === null || deleting.current) return;
    deleting.current = true;
    try {
      // A failed save shows its own notice; either way the dialog closes.
      await deleteArticle(article.id);
    } finally {
      deleting.current = false;
    }
    onClose();
  };

  // Gone at once, so its buttons never sit beside the undo offer's "Annuler" while it fades.
  if (article === null) return null;
  return (
    <AppDialog
      visible
      onDismiss={onClose}
      icon="delete"
      iconTone="error"
      layout="centered"
      title={`Supprimer « ${article.name} » ?`}
      titleRef={titleRef}
      message={consequence(count)}
      cancel={{ label: 'Annuler', onPress: onClose }}
      confirm={{
        label: 'Supprimer',
        onPress: () => void confirm(),
        mode: 'dangerFilled',
      }}
    />
  );
};
