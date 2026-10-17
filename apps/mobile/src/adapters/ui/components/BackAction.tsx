import { AppbarIconAction } from './AppbarIconAction';

/** The header's "Retour": an arrow_back action, 48 dp square (FR-034). */
export const BackAction = ({ onPress }: { onPress: () => void }) => (
  <AppbarIconAction
    icon="arrow_back"
    accessibilityLabel="Retour"
    onPress={onPress}
  />
);
