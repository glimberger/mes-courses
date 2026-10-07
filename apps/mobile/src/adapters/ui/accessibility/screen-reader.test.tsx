import { AccessibilityInfo } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';

import { useScreenReaderOn } from './screen-reader';

afterEach(() => jest.restoreAllMocks());

describe('useScreenReaderOn', () => {
  it('follows the setting read at first, then each change', async () => {
    let changed: ((enabled: boolean) => void) | undefined;
    jest
      .spyOn(AccessibilityInfo, 'isScreenReaderEnabled')
      .mockResolvedValue(true);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((
      _event: string,
      listener: (enabled: boolean) => void,
    ) => {
      changed = listener;
      return { remove: jest.fn() };
    }) as never);

    const { result } = renderHook(() => useScreenReaderOn());
    await act(async () => {});
    expect(result.current).toBe(true);

    act(() => changed?.(false));
    expect(result.current).toBe(false);
  });

  it('keeps a change that comes before the first reading answers', async () => {
    let answer!: (enabled: boolean) => void;
    let changed: ((enabled: boolean) => void) | undefined;
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((
      _event: string,
      listener: (enabled: boolean) => void,
    ) => {
      changed = listener;
      return { remove: jest.fn() };
    }) as never);
    const { result } = renderHook(() => useScreenReaderOn());

    // TalkBack, on at launch, is turned off before the first reading answers.
    act(() => changed?.(false));
    await act(async () => answer(true));

    expect(result.current).toBe(false);
  });
});
