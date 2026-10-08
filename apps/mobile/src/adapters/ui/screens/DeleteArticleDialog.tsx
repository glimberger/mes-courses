import { useEffect, useRef } from 'react';
import { View, type HostInstance } from 'react-native';
import { Dialog, Portal, Text } from 'react-native-paper';

import type { ArticleUsage } from '../../../domain/article';
import { focusOn } from '../accessibility/focus';
import { Button } from '../components/Button';
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
    <Portal>
      <Dialog
        visible
        onDismiss={onClose}
        overlayAccessibilityLabel="Fermer la boîte de dialogue"
      >
        {/* The title read as one header, and the target of the focus move. */}
        <View ref={titleRef} accessible accessibilityRole="header">
          <Dialog.Title>{`Supprimer « ${usage.article.name} » ?`}</Dialog.Title>
        </View>
        <Dialog.Content>
          <Text variant="bodyMedium">{consequence(usage.lists)}</Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onClose}>Annuler</Button>
          <Button onPress={() => void confirm()}>Supprimer</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};
