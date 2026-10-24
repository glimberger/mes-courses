import { StyleSheet, View } from 'react-native';
import { screen } from '@testing-library/react-native';

/** The bottom inset the tests give the safe area: a phone with a home indicator. */
export const BOTTOM_INSET = 34;

/**
 * The screens sit above the tab bar, which already handles the bottom inset: none of their
 * views may pad itself with it again.
 */
export const expectNoBottomInsetPadding = () => {
  const padded = screen
    .UNSAFE_getAllByType(View)
    .filter(
      (view) =>
        StyleSheet.flatten(view.props.style)?.paddingBottom === BOTTOM_INSET,
    );
  expect(padded).toHaveLength(0);
};
