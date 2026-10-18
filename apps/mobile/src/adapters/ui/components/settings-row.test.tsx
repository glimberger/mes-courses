import { render, screen } from '@testing-library/react-native';
import { View } from 'react-native';

import { ThemeProvider } from '../theme/theme-provider';
import { SettingsRow } from './SettingsRow';

type Node = { parent: Node | null };

const ancestors = (node: Node): Node[] => {
  const found: Node[] = [];
  for (let up = node.parent; up; up = up.parent) found.push(up);
  return found;
};

describe('SettingsRow', () => {
  it('#129 draws the footer beside the text, not the trailing element', () => {
    render(
      <SettingsRow
        icon="account_circle"
        title="marc@example.org"
        footer={<View testID="footer" />}
        trailing={<View testID="trailing" />}
      />,
      { wrapper: ThemeProvider },
    );

    const title = ancestors(screen.getByText('marc@example.org') as Node);
    const footer = ancestors(screen.getByTestId('footer') as Node);
    const trailing = ancestors(screen.getByTestId('trailing') as Node);
    // The first ancestor the footer shares with the title is the text column; it must not
    // hold the trailing element, which sits next to the column.
    const column = footer.find((node) => title.includes(node));
    expect(column !== undefined && !trailing.includes(column)).toBe(true);
  });
});
