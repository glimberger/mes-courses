import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Menu, Text, useTheme } from 'react-native-paper';

import type { DeviceInfo } from '../../../application/use-cases/list-devices';
import { AppbarIconAction } from '../components/AppbarIconAction';
import { formatLastSync } from '../components/format-last-sync';
import { SettingsRow } from '../components/SettingsRow';
import type { AppTheme } from '../theme/theme';
import { spacing } from '../theme/spacing';

export type DeviceRowProps = {
  device: DeviceInfo;
  onRename: () => void;
  /** Not offered on this device: disconnecting is its way out. */
  onRevoke: () => void;
};

/**
 * One authorized device, as a settings row: its name, its last sync, a mark on this one, and a menu
 * with "Renommer" and "Révoquer" (US4-8).
 */
export const DeviceRow = ({ device, onRename, onRevoke }: DeviceRowProps) => {
  const [open, setOpen] = useState(false);
  const { colors } = useTheme() as AppTheme;
  const choose = (action: () => void) => () => {
    setOpen(false);
    action();
  };
  return (
    <SettingsRow
      icon="smartphone"
      title={device.name}
      subtitle={`Dernière synchronisation : ${formatLastSync(device.lastSyncAt, new Date())}`}
      trailing={
        <View style={styles.trailing}>
          {device.isThisDevice && (
            <Text variant="labelLarge" style={{ color: colors.primary }}>
              Cet appareil
            </Text>
          )}
          <Menu
            visible={open}
            onDismiss={() => setOpen(false)}
            overlayAccessibilityLabel="Fermer le menu"
            anchor={
              <AppbarIconAction
                icon="more_vert"
                accessibilityLabel={`Actions de ${device.name}`}
                onPress={() => setOpen(true)}
              />
            }
          >
            <Menu.Item title="Renommer" onPress={choose(onRename)} />
            {!device.isThisDevice && (
              <Menu.Item title="Révoquer" onPress={choose(onRevoke)} />
            )}
          </Menu>
        </View>
      }
    />
  );
};

const styles = StyleSheet.create({
  trailing: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
