import { useEffect, useRef, useState, type Ref } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Dialog, Portal, Text } from 'react-native-paper';

import type { ArticleId } from '../../../domain/article';
import {
  parseQuantity,
  type Quantity,
  type QuantityError,
} from '../../../domain/quantity';
import { focusOn } from '../accessibility/focus';
import { formatAmount } from '../components/format-quantity';
import { QuantityFields } from '../components/QuantityFields';
import { useAppStore } from '../state/use-app-store';
import { spacing } from '../theme/spacing';

type DialogArticle = { id: ArticleId; name: string };

/** What the dialog is opened for (contracts/ui-screens.md#quantitydialog). */
export type QuantityRequest =
  /** Adding an article not on the list yet (US2-1, US2-2). */
  | { mode: 'add'; article: DialogArticle }
  /** An article already on the list, with its quantity there (US2-8). */
  | { mode: 'alreadyOnList'; article: DialogArticle; quantity: Quantity | null }
  /** Changing or clearing the quantity of an item (US2-3, US2-4). */
  | { mode: 'edit'; article: DialogArticle; quantity: Quantity | null };

export type QuantityDialogProps = {
  /** Open while set. */
  request: QuantityRequest | null;
  /**
   * Called once the dialog closes, `saved` telling whether it saved something. The screen that
   * opened it moves screen reader focus back (FR-037).
   */
  onClose: (saved: boolean) => void;
};

/**
 * The quantity of one article on the current list, typed in French and read by the domain's
 * `parseQuantity` (FR-014, FR-016, FR-017). A failed save keeps it open: the snackbar says so.
 */
export const QuantityDialog = ({ request, onClose }: QuantityDialogProps) =>
  request && <QuantityForm request={request} onClose={onClose} />;

const QuantityForm = ({
  request,
  onClose,
}: {
  request: QuantityRequest;
  onClose: (saved: boolean) => void;
}) => {
  const addArticleToList = useAppStore((state) => state.addArticleToList);
  const changeItemQuantity = useAppStore((state) => state.changeItemQuantity);
  const { article } = request;
  const [mode, setMode] = useState(request.mode);
  const prefill = request.mode === 'add' ? null : request.quantity;
  const [amount, setAmount] = useState(
    prefill ? formatAmount(prefill.amount) : '',
  );
  const [unit, setUnit] = useState(prefill?.unit ?? '');
  const [error, setError] = useState<QuantityError | null>(null);
  const [saving, setSaving] = useState(false);
  // Set at once, so a second tap before the next render does not save twice.
  const savingRef = useRef(false);
  const titleRef = useRef<View>(null);

  // Screen reader focus goes to the title when the dialog opens (FR-037).
  useEffect(() => {
    focusOn(titleRef);
  }, []);

  const write = async <T,>(run: () => Promise<T>): Promise<T> => {
    savingRef.current = true;
    setSaving(true);
    const outcome = await run();
    savingRef.current = false;
    setSaving(false);
    return outcome;
  };

  const save = async (run: () => Promise<{ ok: boolean }>) => {
    if (savingRef.current) return;
    const outcome = await write(run);
    if (outcome.ok) onClose(true);
  };

  const submit = async () => {
    if (savingRef.current) return;
    const parsed = parseQuantity(amount, unit);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    if (mode !== 'add') {
      await save(() => changeItemQuantity(article.id, parsed.value));
      return;
    }
    const outcome = await write(() => addArticleToList(article, parsed.value));
    if (outcome.ok) {
      onClose(true);
    } else if (outcome.error.type === 'AlreadyOnList') {
      // Added meanwhile: offer to change the quantity it has (US2-8).
      const current = outcome.error.quantity;
      setMode('alreadyOnList');
      setAmount(current ? formatAmount(current.amount) : '');
      setUnit(current?.unit ?? '');
    }
  };

  const close = () => onClose(false);

  return (
    <QuantityDialogForm
      name={article.name}
      mode={mode}
      titleRef={titleRef}
      amount={amount}
      unit={unit}
      onChangeAmount={setAmount}
      onChangeUnit={setUnit}
      error={error}
      saving={saving}
      onClose={close}
      onClear={() => void save(() => changeItemQuantity(article.id, null))}
      onSubmit={() => void submit()}
    />
  );
};

export type QuantityDialogFormProps = {
  /** The article's name, the dialog's title. */
  name: string;
  mode: QuantityRequest['mode'];
  /** The title, which takes screen reader focus when the dialog opens (FR-037). */
  titleRef?: Ref<View> | undefined;
  amount: string;
  unit: string;
  onChangeAmount: (text: string) => void;
  onChangeUnit: (text: string) => void;
  error: QuantityError | null;
  saving: boolean;
  onClose: () => void;
  /** "Effacer la quantité", in edit mode only. */
  onClear: () => void;
  onSubmit: () => void;
};

/**
 * The quantity dialog as drawn, its values, errors and callbacks given as props, so a story can
 * show each error (T058).
 */
export const QuantityDialogForm = ({
  name,
  mode,
  titleRef,
  amount,
  unit,
  onChangeAmount,
  onChangeUnit,
  error,
  saving,
  onClose,
  onClear,
  onSubmit,
}: QuantityDialogFormProps) => (
  <Portal>
    {/* Not closed while saving, so the outcome of the save is always shown. */}
    <Dialog visible dismissable={!saving} onDismiss={onClose}>
      {/* The title read as one header, and the target of the focus move. */}
      <View ref={titleRef} accessible accessibilityRole="header">
        <Dialog.Title>{name}</Dialog.Title>
      </View>
      <Dialog.Content style={styles.content}>
        {mode === 'alreadyOnList' && (
          <Text variant="bodyMedium">
            {`« ${name} » est déjà dans la liste.`}
          </Text>
        )}
        <QuantityFields
          amount={amount}
          unit={unit}
          onChangeAmount={onChangeAmount}
          onChangeUnit={onChangeUnit}
          error={error}
        />
      </Dialog.Content>
      <Dialog.Actions>
        <Button disabled={saving} onPress={onClose}>
          {mode === 'alreadyOnList' ? 'Fermer' : 'Annuler'}
        </Button>
        {mode === 'edit' && (
          <Button disabled={saving} onPress={onClear}>
            Effacer la quantité
          </Button>
        )}
        <Button disabled={saving} onPress={onSubmit}>
          {SUBMIT_LABEL[mode]}
        </Button>
      </Dialog.Actions>
    </Dialog>
  </Portal>
);

const SUBMIT_LABEL: Record<QuantityRequest['mode'], string> = {
  add: 'Ajouter',
  edit: 'Enregistrer',
  alreadyOnList: 'Modifier la quantité',
};

const styles = StyleSheet.create({
  content: { gap: spacing.sm },
});
