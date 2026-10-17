import { useEffect, useRef } from 'react';
import { StyleSheet, View, type HostInstance } from 'react-native';
import { Dialog, Portal, Text, useTheme } from 'react-native-paper';

import { focusOn } from '../accessibility/focus';
import { Button } from '../components/Button';
import { IconCircle } from '../components/IconCircle';
import type { AppTheme } from '../theme/theme';
import { spacing } from '../theme/spacing';

export type FinishShoppingDialogProps = {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

/**
 * Asks before unticking every item (US1-8, US1-9). Screen reader focus goes to its title when it
 * opens (FR-037); the screen that opened it moves focus back when it closes.
 */
export const FinishShoppingDialog = ({
  visible,
  onCancel,
  onConfirm,
}: FinishShoppingDialogProps) => {
  const titleRef = useRef<HostInstance>(null);
  const colors = (useTheme() as { colors: AppTheme['colors'] }).colors;
  useEffect(() => {
    if (visible) focusOn(titleRef);
  }, [visible]);

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onCancel}
        overlayAccessibilityLabel="Fermer la boîte de dialogue"
      >
        {/* The title read as one header, and the target of the focus move. */}
        <View ref={titleRef} accessible accessibilityRole="header">
          <Dialog.Title>Terminer les courses ?</Dialog.Title>
        </View>
        <Dialog.Content style={styles.content}>
          <IconCircle icon="check" />
          <Text variant="bodyMedium">
            Tous les articles seront décochés et resteront dans la liste.
          </Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onCancel}>Annuler</Button>
          <Button
            mode="contained-tonal"
            buttonColor={colors.primaryContainer}
            textColor={colors.onPrimaryContainer}
            onPress={onConfirm}
          >
            Terminer
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

const styles = StyleSheet.create({
  content: { gap: spacing.sm, alignItems: 'center' },
});
