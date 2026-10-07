import { useEffect, useRef, useState, type Ref } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  Appbar,
  Button,
  HelperText,
  List,
  RadioButton,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { Article } from '../../../domain/article';
import type { CategoryId } from '../../../domain/category';
import { validateName } from '../../../domain/name';
import { parseQuantity, type QuantityError } from '../../../domain/quantity';
import { focusOn } from '../accessibility/focus';
import { useAnnouncement } from '../accessibility/announce';
import { nameErrorText, NameField } from '../components/NameField';
import { QuantityFields } from '../components/QuantityFields';
import { ScreenStateView } from '../components/ScreenStateView';
import type { RootStackParamList } from '../routes';
import { useAppStoreApi } from '../state/app-store-provider';
import { useAppStore } from '../state/use-app-store';
import { spacing } from '../theme/spacing';
import { QuantityDialog, type QuantityRequest } from './QuantityDialog';

const NO_CATEGORY = 'Choisissez une catégorie.';

/**
 * Creates an article in a category and adds it to the current list, with an optional quantity
 * (US2-7). The name is checked by the domain before anything is saved (FR-022); a name already in
 * the catalog offers to add that article instead (US2-9, US2-20).
 */
export const CreateArticleScreen = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { params } = useRoute<RouteProp<RootStackParamList, 'CreateArticle'>>();
  const createArticleAndAddToList = useAppStore(
    (state) => state.createArticleAndAddToList,
  );
  const addArticleToList = useAppStore((state) => state.addArticleToList);
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
  const addExistingRef = useRef<View>(null);

  /** The quantity typed, or null after showing its error. */
  const typedQuantity = () => {
    const parsed = parseQuantity(amount, unit);
    setQuantityError(parsed.ok ? null : parsed.error);
    return parsed;
  };

  const create = async () => {
    const validated = validateName(name);
    const quantity = typedQuantity();
    setExisting(null);
    setNameError(validated.ok ? null : nameErrorText(validated.error));
    setCategoryMissing(categoryId === null);
    if (!validated.ok || categoryId === null || !quantity.ok) return;

    setSaving(true);
    const outcome = await createArticleAndAddToList(
      { name, categoryId },
      quantity.value,
    );
    setSaving(false);
    if (outcome.ok) {
      navigation.goBack();
      return;
    }
    switch (outcome.error.type) {
      case 'NameAlreadyUsed':
        setExisting(outcome.error.existing);
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
        existingName={existing?.name ?? null}
        onAddExisting={() => existing && void addExisting(existing)}
        addExistingRef={addExistingRef}
        amount={amount}
        unit={unit}
        onChangeAmount={setAmount}
        onChangeUnit={setUnit}
        quantityError={quantityError}
        categoryId={categoryId}
        onChooseCategory={(id) => {
          setCategoryId(id);
          setCategoryMissing(false);
        }}
        categoryMissing={categoryMissing}
        saving={saving}
        onSubmit={() => void create()}
      />
      <QuantityDialog request={request} onClose={closeDialog} />
    </>
  );
};

/**
 * The categories as radio buttons, loaded when it is drawn (US2-7). The new category of US4
 * comes later.
 */
const CategoryPicker = ({
  value,
  onChange,
}: {
  value: CategoryId | null;
  onChange: (id: CategoryId) => void;
}) => {
  const categories = useAppStore((state) => state.categories);
  const loadCategories = useAppStore((state) => state.loadCategories);
  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  return (
    <ScreenStateView
      state={categories}
      errorMessage="Impossible de charger les catégories."
      onRetry={() => void loadCategories()}
      renderSuccess={(data) => (
        <RadioButton.Group
          value={value ?? ''}
          onValueChange={(id) => onChange(id as CategoryId)}
        >
          {data.map((category) => (
            <RadioButton.Item
              key={category.id}
              mode="android"
              label={category.name}
              value={category.id}
            />
          ))}
        </RadioButton.Group>
      )}
    />
  );
};

export type CreateArticleFormProps = {
  /** Goes back, or null when there is nothing to go back to. */
  onBack: (() => void) | null;
  name: string;
  onChangeName: (text: string) => void;
  nameError: string | null;
  /** The article that already has the name, offered to be added instead (US2-9). */
  existingName: string | null;
  onAddExisting: () => void;
  addExistingRef?: Ref<View> | undefined;
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
  const insets = useSafeAreaInsets();
  useAnnouncement(categoryMissing ? NO_CATEGORY : null);
  return (
    // On iOS, typing covers the bottom of the window: the form is pushed up so "Créer et ajouter"
    // stays in sight. Android resizes the window itself.
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <Appbar.Header>
        {onBack && (
          <Appbar.BackAction accessibilityLabel="Retour" onPress={onBack} />
        )}
        <Appbar.Content title="Nouvel article" />
      </Appbar.Header>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.form}
      >
        <NameField value={name} onChangeText={onChangeName} error={nameError} />
        {existingName !== null && (
          <Button
            ref={addExistingRef}
            mode="outlined"
            disabled={saving}
            onPress={onAddExisting}
          >
            {`Ajouter « ${existingName} »`}
          </Button>
        )}
        <QuantityFields
          amount={amount}
          unit={unit}
          onChangeAmount={onChangeAmount}
          onChangeUnit={onChangeUnit}
          error={quantityError}
        />
        <List.Subheader accessibilityRole="header">Catégorie</List.Subheader>
        {categoryMissing && <HelperText type="error">{NO_CATEGORY}</HelperText>}
        <CategoryPicker value={categoryId} onChange={onChooseCategory} />
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom }]}>
        <Button
          mode="contained"
          disabled={saving}
          onPress={onSubmit}
          style={styles.submit}
        >
          Créer et ajouter
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
