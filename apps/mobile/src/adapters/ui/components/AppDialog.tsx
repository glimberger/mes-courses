import type { ReactNode, Ref } from 'react';
import { ScrollView, StyleSheet, View, type HostInstance } from 'react-native';
import { Dialog, Portal, Text, useTheme } from 'react-native-paper';

import { shadows } from '../theme/elevation';
import { shape } from '../theme/shape';
import { spacing } from '../theme/spacing';
import type { AppTheme } from '../theme/theme';
import { Button, type ButtonMode } from './Button';
import { IconCircle, type IconCircleTone } from './IconCircle';

// The mockups' dialog measures (`.dialog`), off the 4 dp grid.
const PADDING_TOP = 26;
const PADDING_SIDES = spacing.lg;
const PADDING_BOTTOM = 18;
const GAP = 14;
const ACTIONS_GAP = spacing.sm;
const ACTIONS_MARGIN_TOP = 6;
const MAX_HEIGHT = '90%';

export type AppDialogAction = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

export type AppDialogProps = {
  visible: boolean;
  /** Set false while a save is running, so its outcome is always shown. */
  dismissable?: boolean;
  onDismiss: () => void;
  /** The title, which takes screen reader focus when the dialog opens (FR-037). */
  title: string;
  titleRef?: Ref<HostInstance> | undefined;
  /** The message under the title, muted. */
  message?: string | undefined;
  /** A Material Symbol name, drawn in a 56 dp circle above the title. */
  icon?: string | undefined;
  iconTone?: IconCircleTone | undefined;
  /** `centered` centers the icon, the title and the message; `start` aligns them to the start. */
  layout?: 'start' | 'centered' | undefined;
  /** Extra content under the message, such as fields. */
  children?: ReactNode | undefined;
  /** A text button on the start side, above the actions ("Effacer la quantité"). */
  startAction?: AppDialogAction | undefined;
  /** The cancel text button, with `confirm`: the two buttons of most dialogs. */
  cancel?: AppDialogAction | undefined;
  /** The confirm button: brand, or dangerFilled for a destructive action. */
  confirm?:
    | (AppDialogAction & {
        mode?: Extract<ButtonMode, 'brand' | 'dangerFilled'>;
      })
    | undefined;
  /** The actions instead of cancel and confirm, end-aligned in the same row. */
  actions?: ReactNode | undefined;
  testID?: string | undefined;
};

/**
 * A dialog of the mockups: a 28 dp corner card on surfaceContainerLowest with the dialog shadow,
 * an optional icon, a title (a header for assistive technology), a message and content, then
 * the actions at the end: a text button, then the confirm button. A content taller than the
 * dialog scrolls.
 */
export const AppDialog = ({
  visible,
  dismissable = true,
  onDismiss,
  title,
  titleRef,
  message,
  icon,
  iconTone = 'brand',
  layout = 'start',
  children,
  startAction,
  cancel,
  confirm,
  actions,
  testID,
}: AppDialogProps) => {
  const theme = useTheme() as AppTheme;
  const { colors } = theme;
  const centered = layout === 'centered';
  return (
    <Portal>
      <Dialog
        {...(testID && { testID: `${testID}-surface` })}
        visible={visible}
        dismissable={dismissable}
        onDismiss={onDismiss}
        overlayAccessibilityLabel="Fermer la boîte de dialogue"
        style={[
          styles.surface,
          {
            backgroundColor: colors.surfaceContainerLowest,
            boxShadow: shadows(theme).dialog,
          },
        ]}
      >
        <View
          testID={testID && `${testID}-content`}
          style={[styles.content, centered && styles.centered]}
        >
          {icon && <IconCircle icon={icon} tone={iconTone} diameter={56} />}
          {/* The title read as one header, and the target of the focus move. */}
          <View ref={titleRef} accessible accessibilityRole="header">
            <Text
              variant="titleLarge"
              style={[
                styles.title,
                { color: colors.onSurface },
                centered && styles.centeredText,
              ]}
            >
              {title}
            </Text>
          </View>
          <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
            {message && (
              <Text
                variant="bodyMedium"
                style={[
                  { color: colors.onSurfaceVariant },
                  centered && styles.centeredText,
                ]}
              >
                {message}
              </Text>
            )}
            {children}
          </ScrollView>
          {startAction && (
            <View
              testID={testID && `${testID}-start-action`}
              style={styles.start}
            >
              <Button
                mode="text"
                onPress={startAction.onPress}
                disabled={startAction.disabled ?? false}
              >
                {startAction.label}
              </Button>
            </View>
          )}
          <View testID={testID && `${testID}-actions`} style={styles.actions}>
            {actions ?? (
              <>
                {cancel && (
                  <Button
                    mode="text"
                    onPress={cancel.onPress}
                    disabled={cancel.disabled ?? false}
                  >
                    {cancel.label}
                  </Button>
                )}
                {confirm && (
                  <Button
                    mode={confirm.mode ?? 'brand'}
                    onPress={confirm.onPress}
                    disabled={confirm.disabled ?? false}
                  >
                    {confirm.label}
                  </Button>
                )}
              </>
            )}
          </View>
        </View>
      </Dialog>
    </Portal>
  );
};

const styles = StyleSheet.create({
  surface: { borderRadius: shape.xl, maxHeight: MAX_HEIGHT },
  content: {
    // Paper gives the first child a 24 dp top margin; the dialog's own padding is the space.
    marginTop: 0,
    paddingTop: PADDING_TOP,
    paddingHorizontal: PADDING_SIDES,
    paddingBottom: PADDING_BOTTOM,
    gap: GAP,
    // Lets the scroll area take the height left under the surface's `maxHeight`.
    flexShrink: 1,
  },
  centered: { alignItems: 'center' },
  centeredText: { textAlign: 'center' },
  title: { textAlign: 'left' },
  scroll: { flexShrink: 1 },
  start: { alignSelf: 'flex-start' },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: ACTIONS_GAP,
    marginTop: ACTIONS_MARGIN_TOP,
  },
});
