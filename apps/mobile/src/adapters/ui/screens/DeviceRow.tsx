import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { IconButton, List, Menu, Text, useTheme } from 'react-native-paper';

import type { DeviceInfo } from '../../../application/use-cases/list-devices';
import { formatLastSync } from '../components/format-last-sync';
import { spacing } from '../theme/spacing';

export type DeviceRowProps = {
  device: DeviceInfo;
  onRename: () => void;
  /** Not offered on this device: disconnecting is its way out. */
  onRevoke: () => void;
};

/** One authorized device: its name, its last sync, a mark on this one and a menu (US4-8). */
export const DeviceRow = ({ device, onRename, onRevoke }: DeviceRowProps) => {
  const [open, setOpen] = useState(false);
  const { colors } = useTheme();
  const choose = (action: () => void) => () => {
    setOpen(false);
    action();
  };
  return (
    <List.Item
      title={device.name}
      description={() => (
        <View style={styles.description}>
          <Text variant="bodyMedium">
            Dernière synchronisation :{' '}
            {formatLastSync(device.lastSyncAt, new Date())}
          </Text>
          {device.isThisDevice && (
            <Text variant="labelLarge" style={{ color: colors.primary }}>
              Cet appareil
            </Text>
          )}
        </View>
      )}
      right={() => (
        <Menu
          visible={open}
          onDismiss={() => setOpen(false)}
          anchor={
            <IconButton
              icon="dots-vertical"
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
      )}
    />
  );
};

const styles = StyleSheet.create({
  description: { gap: spacing.xs },
});
