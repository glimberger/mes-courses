import type { RefObject } from 'react';

import type { focusOn } from '../accessibility/focus';

/** The text of an element and of everything inside it. */
const textOf = (children: unknown): string => {
  if (typeof children === 'string' || typeof children === 'number') {
    return String(children);
  }
  if (Array.isArray(children)) return children.map(textOf).join('');
  if (children && typeof children === 'object' && 'props' in children) {
    return textOf(
      (children as { props: { children?: unknown } }).props.children,
    );
  }
  return '';
};

// The delay of the real `focusOn`: the element can mount any time within it.
const MOUNT_WINDOW_MS = 300;

/**
 * Has the mocked `focusOn` record what each focus move went to: the element's label, or its
 * text. Like `focusOn`, it looks at the element once the screen has settled, when a dialog drawn
 * in a portal is mounted: it retries until the element is there, for as long as `focusOn` waits.
 * Call it in a `beforeEach`; the array it returns fills as focus moves.
 */
export const recordFocusTargets = (
  mocked: jest.MockedFunction<typeof focusOn>,
): string[] => {
  const targets: string[] = [];
  mocked.mockImplementation((target) => {
    const startedAt = Date.now();
    const record = () => {
      const props = (
        target as unknown as RefObject<{ props: Record<string, unknown> }>
      ).current?.props;
      if (!props && Date.now() - startedAt < MOUNT_WINDOW_MS) {
        setTimeout(record, 0);
        return;
      }
      targets.push(
        (props?.accessibilityLabel as string | undefined) ??
          textOf(props?.children),
      );
    };
    setTimeout(record, 0);
  });
  return targets;
};
