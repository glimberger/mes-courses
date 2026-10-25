import { useEffect, useRef, useState, type Ref } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type HostInstance,
} from 'react-native';
import { HelperText } from 'react-native-paper';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { Article } from '../../../domain/article';
import type { CategoryId } from '../../../domain/category';
import { validateName } from '../../../domain/name';
import { ok } from '../../../domain/result';
import { parseQuantity, type QuantityError } from '../../../domain/quantity';
import { focusOn } from '../accessibility/focus';
import { useAnnouncement } from '../accessibility/announce';
import { CategoryHeader } from '../components/CategoryHeader';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button } from '../components/Button';
import { CategoryPicker } from '../components/CategoryPicker';
import { nameErrorText, NameField } from '../components/NameField';
import { QuantityFields } from '../components/QuantityFields';
import type { RootStackParamList } from '../routes';
import { useAppStoreApi } from '../state/app-store-provider';
import { useAppStore } from '../state/use-app-store';
import { spacing } from '../theme/spacing';
import { QuantityDialog, type QuantityRequest } from './QuantityDialog';
import { paperRef } from '../components/paper-ref';

const NO_CATEGORY = 'Choisissez une catégorie.';

/**
 * Creates an article in a category and adds it to the current list, with an optional quantity
 * (US2-7). The name is checked by the domain before anything is saved (FR-022); a name already in
 * the catalog offers to add that article instead (US2-9, US2-20). The category picker
 * creates a category and chooses it (US4-2).
 */
export const CreateArticleScreen = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { params } = useRoute<RouteProp<RootStackParamList, 'CreateArticle'>>();
  const createArticleAndAddToList = useAppStore(
    (state) => state.createArticleAndAddToList,
  );
  const createArticleInCatalog = useAppStore((state) => state.createArticle);
  const addArticleToList = useAppStore((state) => state.addArticleToList);
  // The Articles tab creates in the catalog only; the Courses tab also adds to the list.
  const addToList = params?.addToList ?? true;
  const store = useAppStoreApi();

  // The confirmation of an earlier addition no longer applies to this form. A failure notice
  // stays, so the user still reads it.
  useEffect(() => {
    const { notice, dismissNotice } = store.getState();
    if (notice?.type === 'articleAdded') dismissNotice();
  }, [store]);

  const [name, setName] = useState(params?.name ?? '');
  const [categoryId, setCategoryId] = useState<CategoryId | null>(
    params?.categoryId ?? null,
  );
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [existing, setExisting] = useState<Article | null>(null);
  const [categoryMissing, setCategoryMissing] = useState(false);
  const [quantityError, setQuantityError] = useState<QuantityError | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [request, setRequest] = useState<QuantityRequest | null>(null);
  const addExistingRef = useRef<HostInstance>(null);

  const chooseCategory = (id: CategoryId) => {
    setCategoryId(id);
    setCategoryMissing(false);
  };

  /** The quantity typed, or null after showing its error. */
  const typedQuantity = () => {
    const parsed = parseQuantity(amount, unit);
    setQuantityError(parsed.ok ? null : parsed.error);
    return parsed;
  };

  const create = async () => {
    const validated = validateName(name);
    const quantity = addToList ? typedQuantity() : ok(null);
    setExisting(null);
    setNameError(validated.ok ? null : nameErrorText(validated.error));
    setCategoryMissing(categoryId === null);
    if (!validated.ok || categoryId === null || !quantity.ok) return;

    setSaving(true);
    const outcome = addToList
      ? await createArticleAndAddToList({ name, categoryId }, quantity.value)
      : await createArticleInCatalog({ name, categoryId });
    setSaving(false);
    if (outcome.ok) {
      navigation.goBack();
      return;
    }
    switch (outcome.error.type) {
      case 'NameAlreadyUsed':
        // Nothing to add the existing article to, in the catalog.
        if (addToList) setExisting(outcome.error.existing);
        setNameError(`« ${outcome.error.existing.name} » existe déjà.`);
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

  /** Adds the article of that name instead, with the quantity typed (US2-9). */
  const addExisting = async (article: Article) => {
    const quantity = typedQuantity();
    if (!quantity.ok) return;
    setSaving(true);
    const outcome = await addArticleToList(article, quantity.value);
    setSaving(false);
    if (outcome.ok) {
      navigation.goBack();
    } else if (outcome.error.type === 'AlreadyOnList') {
      // Already on the list: offer to change its quantity there (US2-20, FR-011).
      setRequest({
        mode: 'alreadyOnList',
        article: { id: article.id, name: article.name },
        quantity: outcome.error.quantity,
      });
    }
  };

  const closeDialog = (saved: boolean) => {
    setRequest(null);
    if (saved) navigation.goBack();
    else focusOn(addExistingRef);
  };

  return (
    <>
      <CreateArticleForm
        onBack={navigation.canGoBack() ? () => navigation.goBack() : null}
        name={name}
        onChangeName={(text) => {
          setName(text);
          setExisting(null);
        }}
        nameError={nameError}
        addToList={addToList}
        existingName={existing?.name ?? null}
        onAddExisting={() => existing && void addExisting(existing)}
        addExistingRef={addExistingRef}
        amount={amount}
        unit={unit}
        onChangeAmount={setAmount}
        onChangeUnit={setUnit}
        quantityError={quantityError}
        categoryId={categoryId}
        onChooseCategory={chooseCategory}
        categoryMissing={categoryMissing}
        saving={saving}
        onSubmit={() => void create()}
      />
      <QuantityDialog request={request} onClose={closeDialog} />
    </>
  );
};

export type CreateArticleFormProps = {
  /** False in the Articles tab: no quantity, and the article is created in the catalog only. */
  addToList?: boolean;
  /** Goes back, or null when there is nothing to go back to. */
  onBack: (() => void) | null;
  name: string;
  onChangeName: (text: string) => void;
  nameError: string | null;
  /** The article that already has the name, offered to be added instead (US2-9). */
  existingName: string | null;
  onAddExisting: () => void;
  addExistingRef?: Ref<HostInstance> | undefined;
  amount: string;
  unit: string;
  onChangeAmount: (text: string) => void;
  onChangeUnit: (text: string) => void;
  quantityError: QuantityError | null;
  categoryId: CategoryId | null;
  onChooseCategory: (id: CategoryId) => void;
  categoryMissing: boolean;
  saving: boolean;
  onSubmit: () => void;
};

/**
 * The form of CreateArticle, its values, errors and callbacks given as props, so a story can show
 * each error (T058). Only the category picker reads the store.
 */
export const CreateArticleForm = ({
  addToList = true,
  onBack,
  name,
  onChangeName,
  nameError,
  existingName,
  onAddExisting,
  addExistingRef,
  amount,
  unit,
  onChangeAmount,
  onChangeUnit,
  quantityError,
  categoryId,
  onChooseCategory,
  categoryMissing,
  saving,
  onSubmit,
}: CreateArticleFormProps) => {
  useAnnouncement(categoryMissing ? NO_CATEGORY : null);
  return (
    // On iOS, typing covers the bottom of the window: the form is pushed up so "Créer et ajouter"
    // stays in sight. Android resizes the window itself.
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <ScreenHeader
        variant="center"
        title="Nouvel article"
        onBack={onBack ?? undefined}
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.form}
      >
        <NameField value={name} onChangeText={onChangeName} error={nameError} />
        {existingName !== null && (
          <Button
            ref={paperRef(addExistingRef)}
            mode="outlined"
            disabled={saving}
            onPress={onAddExisting}
          >
            {`Ajouter « ${existingName} »`}
          </Button>
        )}
        {addToList && (
          <QuantityFields
            amount={amount}
            unit={unit}
            onChangeAmount={onChangeAmount}
            onChangeUnit={onChangeUnit}
            error={quantityError}
          />
        )}
        <CategoryHeader title="Catégorie" />
        {categoryMissing && <HelperText type="error">{NO_CATEGORY}</HelperText>}
        <CategoryPicker
          value={categoryId}
          onChange={onChooseCategory}
          disabled={saving}
        />
      </ScrollView>
      <View style={styles.footer}>
        <Button
          mode="brand"
          disabled={saving}
          onPress={onSubmit}
          style={styles.submit}
        >
          {addToList ? 'Créer et ajouter' : 'Créer'}
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
