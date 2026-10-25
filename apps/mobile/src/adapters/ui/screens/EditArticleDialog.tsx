import { useEffect, useRef, useState } from 'react';
import type { HostInstance } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import type { ArticleId } from '../../../domain/article';
import type { CategoryId } from '../../../domain/category';
import { validateName } from '../../../domain/name';
import { focusOn } from '../accessibility/focus';
import { AppDialog } from '../components/AppDialog';
import { CategoryPicker } from '../components/CategoryPicker';
import { nameErrorText, NameField } from '../components/NameField';
import { AppStoreProvider, useAppStoreApi } from '../state/app-store-provider';
import { useAppStore } from '../state/use-app-store';
import { useRemoteRemoval } from '../state/use-remote-removal';
import type { AppTheme } from '../theme/theme';

/** What the dialog edits: the article as it was when the menu opened. */
export type EditedArticle = {
  id: ArticleId;
  name: string;
  categoryId: CategoryId;
};

export type EditArticleDialogProps = {
  /** The article to edit; the dialog is open while it is set. */
  article: EditedArticle | null;
  /** The number of lists holding the article. */
  count: number;
  onClose: () => void;
};

/** The note of the contract (mockup 22): how many lists the change reaches. */
export const changeNote = (count: number): string => {
  if (count <= 0) return 'Cet article n’est dans aucune liste.';
  return count === 1
    ? 'Ce changement s’applique à 1 liste.'
    : `Ce changement s’applique à ${count} listes.`;
};

/**
 * Renames an article and changes its category from the Articles tab (spec 011, AC3). Mounted only
 * while open, so its fields start from the article each time. A refused name stays in the field
 * with its error; a failed save is told by the snackbar and the dialog stays open.
 */
export const EditArticleDialog = ({
  article,
  count,
  onClose,
}: EditArticleDialogProps) =>
  article === null ? null : (
    <OpenEditArticleDialog article={article} count={count} onClose={onClose} />
  );

const OpenEditArticleDialog = ({
  article,
  count,
  onClose,
}: Omit<EditArticleDialogProps, 'article'> & { article: EditedArticle }) => {
  const { colors } = useTheme() as AppTheme;
  // The dialog is drawn in Paper's portal, which sits above the store's provider: the fields
  // that read the store get it again from here.
  const store = useAppStoreApi();
  const editArticle = useAppStore((state) => state.editArticle);
  const noticeRemoteRemoval = useAppStore((state) => state.noticeRemoteRemoval);
  const [name, setName] = useState(article.name);
  const [categoryId, setCategoryId] = useState<CategoryId>(article.categoryId);
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Set at once, so a second tap before the next render does not save twice.
  const savingRef = useRef(false);
  const titleRef = useRef<HostInstance>(null);

  // The confirmation of an earlier addition no longer applies once an edit starts (002). A
  // failure notice stays, so the user still reads it.
  useEffect(() => {
    const { notice, dismissNotice } = store.getState();
    if (notice?.type === 'articleAdded') dismissNotice();
  }, [store]);

  // Screen reader focus goes to the title when the dialog opens (FR-037).
  useEffect(() => {
    focusOn(titleRef);
  }, []);

  // A pull that deletes the article closes the dialog (FR-020a).
  useRemoteRemoval({ articleId: article.id }, (reason) => {
    noticeRemoteRemoval(reason);
    onClose();
  });

  const save = async () => {
    if (savingRef.current) return;
    const validated = validateName(name);
    setNameError(validated.ok ? null : nameErrorText(validated.error));
    if (!validated.ok) return;

    savingRef.current = true;
    setSaving(true);
    const outcome = await editArticle(article.id, { name, categoryId });
    savingRef.current = false;
    setSaving(false);
    if (outcome.ok) {
      onClose();
      return;
    }
    switch (outcome.error.type) {
      case 'NameAlreadyUsed':
        setNameError(
          `Un article « ${outcome.error.existing.name} » existe déjà.`,
        );
        return;
      case 'NameRequired':
      case 'NameTooLong':
        setNameError(nameErrorText(outcome.error));
        return;
      case 'WriteFailed':
        // The snackbar says so; the form stays as typed.
        return;
    }
  };

  return (
    <AppDialog
      visible
      // Not closed while saving, so the outcome of the save is always shown.
      dismissable={!saving}
      onDismiss={onClose}
      title="Modifier l'article"
      titleRef={titleRef}
      cancel={{ label: 'Annuler', onPress: onClose, disabled: saving }}
      confirm={{
        label: 'Enregistrer',
        onPress: () => void save(),
        disabled: saving,
      }}
    >
      <AppStoreProvider store={store}>
        <NameField
          context="dialog"
          value={name}
          onChangeText={setName}
          error={nameError}
          disabled={saving}
        />
        <CategoryPicker
          value={categoryId}
          onChange={setCategoryId}
          disabled={saving}
        />
      </AppStoreProvider>
      <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
        {changeNote(count)}
      </Text>
    </AppDialog>
  );
};
