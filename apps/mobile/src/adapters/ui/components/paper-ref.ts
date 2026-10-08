import type { Ref } from 'react';
import type { HostInstance, View } from 'react-native';

/**
 * A ref to a native element, typed as React Native Paper still types its refs: with `View`,
 * which React Native 0.88 turned into a component type. The element Paper sets is the same
 * host instance.
 */
export const paperRef = (
  ref: Ref<HostInstance> | undefined,
): Ref<View> | undefined => ref as unknown as Ref<View> | undefined;
