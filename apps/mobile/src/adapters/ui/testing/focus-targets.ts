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

/**
 * Has the mocked `focusOn` record what each focus move went to: the element's label, or its
 * text. Like `focusOn`, it looks at the element once the screen has settled, when a dialog drawn
 * in a portal is mounted. Call it in a `beforeEach`; the array it returns fills as focus moves.
 */
export const recordFocusTargets = (
  mocked: jest.MockedFunction<typeof focusOn>,
): string[] => {
  const targets: string[] = [];
  mocked.mockImplementation((target) => {
    setTimeout(() => {
      const props = (target as RefObject<{ props: Record<string, unknown> }>)
        .current?.props;
      targets.push(
        (props?.accessibilityLabel as string | undefined) ??
          textOf(props?.children),
      );
    }, 0);
  });
  return targets;
};
