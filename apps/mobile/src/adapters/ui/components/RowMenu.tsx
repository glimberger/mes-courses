import { useState } from 'react';
import { Menu } from 'react-native-paper';

import { AppbarIconAction } from './AppbarIconAction';

export type RowMenuItem = {
  /** The text of the entry, e.g. "Quantité…". */
  title: string;
  /** What screen readers read for the entry: it names the article. */
  accessibilityLabel: string;
  onPress: () => void;
};

export type RowMenuProps = {
  /** The article of the row, named by the button's label. */
  name: string;
  items: RowMenuItem[];
  /** Opens the menu when first shown (stories and screenshots). */
  defaultVisible?: boolean;
};

/**
 * The ⋮ button at the end of a row and the menu it opens. The button is a 48 dp target labelled
 * "Actions pour <name>"; choosing an entry closes the menu, then runs its action.
 */
export const RowMenu = ({
  name,
  items,
  defaultVisible = false,
}: RowMenuProps) => {
  const [visible, setVisible] = useState(defaultVisible);
  const button = (
    <AppbarIconAction
      icon="more_vert"
      accessibilityLabel={`Actions pour ${name}`}
      onPress={() => setVisible(true)}
    />
  );
  // Paper's `Menu` starts a 250 ms hide when it mounts closed, and that hide unmounts the menu
  // even if it was opened meanwhile. Mounting it only while open skips that stale hide.
  if (!visible) return button;
  return (
    <Menu
      visible
      onDismiss={() => setVisible(false)}
      overlayAccessibilityLabel="Fermer le menu"
      anchorPosition="bottom"
      anchor={button}
    >
      {items.map(({ title, accessibilityLabel, onPress }) => (
        <Menu.Item
          key={title}
          title={title}
          accessibilityLabel={accessibilityLabel}
          onPress={() => {
            setVisible(false);
            onPress();
          }}
        />
      ))}
    </Menu>
  );
};
