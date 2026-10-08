import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Appbar } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { validateName } from '../../../domain/name';
import { BackAction } from '../components/BackAction';
import { Button } from '../components/Button';
import { nameErrorText, NameField } from '../components/NameField';
import type { RootStackParamList } from '../routes';
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
  const editArticle = useAppStore((state) => state.editArticle);
  const full = useAppStore((state) => state.catalog.full);
  const current = (() => {
    if (full.status !== 'success') return null;
    for (const section of full.data.sections) {
      const article = section.articles.find((a) => a.id === params.articleId);
      if (article) {
        return { name: article.name, categoryId: section.category.id };
      }
    }
    return null;
  })();

  const [initial] = useState(current);
  const [name, setName] = useState(initial?.name ?? '');
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const validated = validateName(name);
    setNameError(validated.ok ? null : nameErrorText(validated.error));
    if (!validated.ok || initial === null) return;

    setSaving(true);
    const outcome = await editArticle(params.articleId, {
      name,
      categoryId: initial.categoryId,
    });
    setSaving(false);
    if (outcome.ok) {
      navigation.goBack();
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
