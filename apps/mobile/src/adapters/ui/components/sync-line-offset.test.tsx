import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';

import {
  SYNC_LINE_HEIGHT,
  SyncLineOffsetProvider,
  useSyncLineHeight,
} from './SyncLineOffset';

const Reader = () => <Text testID="height">{useSyncLineHeight()}</Text>;

describe('SyncLineOffset', () => {
  it('is 36 dp high when shown', () => {
    expect(SYNC_LINE_HEIGHT).toBe(36);
  });

  it('defaults to 0 without a provider', () => {
    render(<Reader />);
    expect(screen.getByTestId('height')).toHaveTextContent('0');
  });

  it("reads the provider's value", () => {
    render(
      <SyncLineOffsetProvider value={SYNC_LINE_HEIGHT}>
        <Reader />
      </SyncLineOffsetProvider>,
    );
    expect(screen.getByTestId('height')).toHaveTextContent('36');
  });
});
