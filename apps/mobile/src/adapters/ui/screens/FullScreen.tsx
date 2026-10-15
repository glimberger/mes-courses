import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from 'react-native-paper';

/**
 * Fills the window with Material 3's theme background for views shown in
 * place of the app. The existing app composes SafeAreaProvider around its
 * ready content; this shell deliberately owns only the window background and
 * full-screen layout, so inset-aware children must opt into the shared safe
 * area convention.
 */
export const FullScreen = ({ children }: { children: ReactNode }) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
