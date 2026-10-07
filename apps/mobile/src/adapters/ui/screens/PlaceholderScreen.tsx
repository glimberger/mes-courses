import type { ReactNode } from 'react';
import { useNavigation } from '@react-navigation/native';
import { Appbar } from 'react-native-paper';

/**
 * A screen not built yet: its Appbar only. Each user story replaces one with the real screen.
 */
export const PlaceholderScreen = ({
  title,
  children,
}: {
  title: string;
  /** Appbar actions. */
  children?: ReactNode;
}) => {
  const navigation = useNavigation();
  return (
    <Appbar.Header>
      {navigation.canGoBack() && (
        <Appbar.BackAction onPress={() => navigation.goBack()} />
      )}
      <Appbar.Content title={title} />
      {children}
    </Appbar.Header>
  );
};
