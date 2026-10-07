import { globSync } from 'node:fs';
import path from 'node:path';
import type { ComponentType } from 'react';

import { composeStories } from '@storybook/react';
import { render } from '@testing-library/react-native';

import preview from '../../../.rnstorybook/preview';
import { requiredStories } from './required-stories';

// The scheme every story is rendered with, read by `useColorScheme`.
let mockColorScheme: 'light' | 'dark' = 'light';
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => mockColorScheme,
}));

const APP_ROOT = path.resolve(__dirname, '../../..');

interface StoryEntry {
  id: string;
  Story: ComponentType;
}

function loadStories(): StoryEntry[] {
  const files = globSync('src/adapters/ui/**/*.stories.tsx', { cwd: APP_ROOT });
  return files.flatMap((file) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const storyModule = require(path.join(APP_ROOT, file));
    const title: unknown = storyModule.default?.title;
    if (typeof title !== 'string') {
      throw new Error(`${file} must declare a title in its default export`);
    }
    const composed = composeStories(storyModule, preview) as Record<
      string,
      ComponentType
    >;
    return Object.entries(composed).map(([name, Story]) => ({
      id: `${title}/${name}`,
      Story,
    }));
  });
}

const stories = loadStories();

describe('every story renders in the light and the dark scheme', () => {
  for (const { id, Story } of stories) {
    for (const scheme of ['light', 'dark'] as const) {
      it(`${id} in ${scheme}`, () => {
        mockColorScheme = scheme;
        const error = jest.spyOn(console, 'error').mockImplementation();
        const warn = jest.spyOn(console, 'warn').mockImplementation();
        try {
          render(<Story />);
          expect(error).not.toHaveBeenCalled();
          expect(warn).not.toHaveBeenCalled();
        } finally {
          error.mockRestore();
          warn.mockRestore();
        }
      });
    }
  }
});

describe('required stories exist', () => {
  it('lists each required story once', () => {
    expect(new Set(requiredStories).size).toBe(requiredStories.length);
  });

  const ids = stories.map((story) => story.id);
  for (const id of requiredStories) {
    it(`has the story ${id}`, () => {
      expect(ids).toContain(id);
    });
  }
});
