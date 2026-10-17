import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { Card } from './Card';

export type SettingsCardProps = {
  children: ReactNode;
  /** The actions card: its rows sit 10 dp apart, not 14. */
  dense?: boolean | undefined;
  testID?: string | undefined;
};

// The mockups' settings card (`.card.pad`): 16 dp padding, 14 dp between rows (10 when dense).
const GAP = 14;
const DENSE_GAP = 10;

/** A settings group: the mockups' card, with its rows spaced inside it. */
export const SettingsCard = ({
  children,
  dense = false,
  testID,
}: SettingsCardProps) => (
  <Card testID={testID} style={[styles.card, { gap: dense ? DENSE_GAP : GAP }]}>
    {children}
  </Card>
);

const styles = StyleSheet.create({
  card: { padding: 16 },
});
