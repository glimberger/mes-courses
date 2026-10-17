import { useEffect, useRef } from 'react';
import type { HostInstance } from 'react-native';

import type { ArticleUsage } from '../../../domain/article';
import { focusOn } from '../accessibility/focus';
import { AppDialog } from '../components/AppDialog';
import { joinFrench } from '../components/join-french';
import { useAppStore } from '../state/use-app-store';

export type DeleteArticleDialogProps = {
  /** Where the article is used; the dialog is open while it is set. */
  usage: ArticleUsage | null;
  onClose: () => void;
};

const consequence = (lists: ArticleUsage['lists']): string => {
  if (lists.length === 0) return "L'article sera retiré du catalogue.";
  const names = joinFrench(lists.map((list) => list.name));
  return lists.length === 1
    ? `Il est dans la liste ${names} et en sera retiré.`
    : `Il est dans les listes ${names} et en sera retiré.`;
};

/**
 * Asks before deleting an article, naming the lists it will leave (FR-006, US2-3). Screen reader
 * focus goes to its title when it opens (FR-037); the screen that opened it moves focus back
 * when it closes.
 */
export const DeleteArticleDialog = ({
  usage,
  onClose,
}: DeleteArticleDialogProps) => {
  const deleteArticle = useAppStore((state) => state.deleteArticle);
  const titleRef = useRef<HostInstance>(null);
  // A second tap on "Supprimer" must not delete, or close, twice.
  const deleting = useRef(false);
  const visible = usage !== null;
  useEffect(() => {
    if (visible) focusOn(titleRef);
  }, [visible]);

  const confirm = async () => {
    if (usage === null || deleting.current) return;
    deleting.current = true;
    try {
      // A failed save shows its own notice; either way the dialog closes.
      await deleteArticle(usage.article.id);
    } finally {
      deleting.current = false;
    }
    onClose();
  };

  // Gone at once, so its buttons never sit beside the undo offer's "Annuler" while it fades.
  if (usage === null) return null;
  return (
    <AppDialog
      visible
      onDismiss={onClose}
      icon="delete"
      iconTone="error"
      layout="centered"
      title={`Supprimer « ${usage.article.name} » ?`}
      titleRef={titleRef}
      message={consequence(usage.lists)}
      cancel={{ label: 'Annuler', onPress: onClose }}
      confirm={{
        label: 'Supprimer',
        onPress: () => void confirm(),
        mode: 'dangerFilled',
      }}
    />
  );
};
