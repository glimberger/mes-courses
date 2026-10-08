import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Appbar, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { ArticleId } from '../../../domain/article';
import type { CategoryId } from '../../../domain/category';
import { validateName } from '../../../domain/name';
import { BackAction } from '../components/BackAction';
import { Button } from '../components/Button';
import { nameErrorText, NameField } from '../components/NameField';
import type { RootStackParamList } from '../routes';
import { useAppStoreApi } from '../state/app-store-provider';
import { useAppStore } from '../state/use-app-store';
import { spacing } from '../theme/spacing';

/**
 * Renames an article (002 User Story 1). It reads the article from the loaded catalog and saves
 * it in its current category; the category field comes with User Story 3. A refused name stays
 * in the field with its error; a failed save is told by the snackbar.
 */
export const EditArticleScreen = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { params } = useRoute<RouteProp<RootStackParamList, 'EditArticle'>>();
  const store = useAppStoreApi();
  const full = useAppStore((state) => state.catalog.full);

  // The confirmation of an earlier addition no longer applies here, and no snackbar shows after
  // a save (002 ui-screens.md). A failure notice stays, so the user still reads it.
  useEffect(() => {
    const { notice, dismissNotice } = store.getState();
    if (notice?.type === 'articleAdded') dismissNotice();
  }, [store]);
  const found = (() => {
    if (full.status !== 'success') return null;
    for (const section of full.data.sections) {
      const article = section.articles.find((a) => a.id === params.articleId);
      if (article) {
        return { name: article.name, categoryId: section.category.id };
      }
    }
    return null;
  })();
  // The first article found is kept for the life of the screen, so a reload of the catalog
  // never resets what the user typed.
  const [initial, setInitial] = useState(found);
  if (initial === null && found !== null) setInitial(found);

  if (initial === null) {
    return (
      <View style={styles.screen}>
        <Appbar.Header>
          {navigation.canGoBack() && (
            <BackAction onPress={() => navigation.goBack()} />
          )}
          <Appbar.Content title="Modifier l'article" />
        </Appbar.Header>
        <Text style={styles.form}>
          {full.status === 'loading' || full.status === 'idle'
            ? 'Chargement…'
            : 'Cet article est introuvable.'}
        </Text>
      </View>
    );
  }
  return <LoadedEditArticle articleId={params.articleId} initial={initial} />;
};

const LoadedEditArticle = ({
  articleId,
  initial,
}: {
  articleId: ArticleId;
  initial: { name: string; categoryId: CategoryId };
}) => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const editArticle = useAppStore((state) => state.editArticle);
  const [name, setName] = useState(initial.name);
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const validated = validateName(name);
    setNameError(validated.ok ? null : nameErrorText(validated.error));
    if (!validated.ok) return;

    setSaving(true);
    const outcome = await editArticle(articleId, {
      name,
      categoryId: initial.categoryId,
    });
    setSaving(false);
    if (outcome.ok) {
      // The user may have left while the save refreshed the screens.
      if (navigation.isFocused()) navigation.goBack();
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
    <EditArticleForm
      onBack={navigation.canGoBack() ? () => navigation.goBack() : null}
      name={name}
      onChangeName={setName}
      nameError={nameError}
      saving={saving}
      onSubmit={() => void save()}
    />
  );
};

export type EditArticleFormProps = {
  /** Goes back, or null when there is nothing to go back to. */
  onBack: (() => void) | null;
  name: string;
  onChangeName: (text: string) => void;
  nameError: string | null;
  saving: boolean;
  onSubmit: () => void;
};

/**
 * The form of EditArticle, its values, errors and callbacks given as props, so a story can show
 * each error.
 */
export const EditArticleForm = ({
  onBack,
  name,
  onChangeName,
  nameError,
  saving,
  onSubmit,
}: EditArticleFormProps) => {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <Appbar.Header>
        {onBack && <BackAction onPress={onBack} />}
        <Appbar.Content title="Modifier l'article" />
      </Appbar.Header>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.form}
      >
        <NameField value={name} onChangeText={onChangeName} error={nameError} />
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom }]}>
        <Button
          mode="contained"
          disabled={saving}
          onPress={onSubmit}
          style={styles.submit}
        >
          Enregistrer
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  form: { padding: spacing.md, gap: spacing.sm },
  footer: { paddingHorizontal: spacing.md },
  submit: { marginVertical: spacing.sm },
});
