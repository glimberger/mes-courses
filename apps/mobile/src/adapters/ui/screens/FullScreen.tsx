import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from 'react-native-paper';

/** Fills the window with the theme's background, for the views shown in place of the app. */
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
