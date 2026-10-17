import {
  useEffect,
  useState,
  type ComponentType,
  type ReactElement,
} from 'react';
import * as Font from 'expo-font';
import { Pressable, StyleSheet, View } from 'react-native';

import { nunitoFontFiles } from '../theme/fonts';

export type ShotStory = { id: string; Story: ComponentType };

type Decorator = (
  Story: ComponentType,
  context: { parameters: object; args: object },
) => ReactElement;
type StoryExport = {
  args?: object;
  parameters?: object;
  render?: (args: object) => ReactElement;
};
type StoryFile = {
  default: StoryExport & { title?: unknown; component?: ComponentType<never> };
  [name: string]: unknown;
};

/**
 * What `composeStories` of Storybook does for the stories of this app, without its web-only
 * imports (it needs `react-dom`, which the app does not have): the args and parameters of the
 * file and of the story merged, the story's `render` or the file's component, then the
 * decorators around it. Ids are `title/export`, as in the story test and `required-stories.ts`.
 */
export const composeShotStories = (
  file: StoryFile,
  // Whatever the preview lists: its decorators take the story's context, which is built here.
  decorators: readonly unknown[],
): ShotStory[] => {
  const { title, component: Component, ...meta } = file.default;
  if (typeof title !== 'string') {
    throw new Error('A story file must declare a title in its default export');
  }
  return Object.entries(file)
    .filter(([name]) => name !== 'default')
    .map(([name, value]) => {
      const story = value as StoryExport;
      const args = { ...meta.args, ...story.args };
      const parameters = { ...meta.parameters, ...story.parameters };
      const render =
        story.render ??
        meta.render ??
        (Component
          ? (props: object) => {
              const Rendered = Component as ComponentType<object>;
              return <Rendered {...props} />;
            }
          : () => null);
      const Body = () => render(args);
      const Decorated = decorators.reduce<ComponentType>(
        (Inner, decorate) =>
          function Wrapped() {
            return (decorate as Decorator)(Inner, { parameters, args });
          },
        Body,
      );
      return { id: `${title}/${name}`, Story: Decorated };
    });
};

/**
 * The root of the screenshot build (never of a store build): one story at a time, full screen.
 * An end-to-end test moves through the stories by pressing `shots-next`, which is transparent
 * and carries the id of the story on screen as its label, so no story id has to be passed in
 * (the app has no URL scheme to carry it).
 */
export const StoryShots = ({ stories }: { stories: readonly ShotStory[] }) => {
  const [index, setIndex] = useState(0);
  // The app loads Nunito in App.tsx, which a story build does not run: without it a capture is
  // drawn in the system font.
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    Font.loadAsync(nunitoFontFiles).then(
      () => setFontsReady(true),
      () => setFontsReady(true),
    );
  }, []);
  const current = stories[index];
  if (!fontsReady || current === undefined) return null;
  const { id, Story } = current;
  return (
    <View style={styles.root}>
      <Story key={id} />
      <Pressable
        // A new view for each story: Android does not refresh the label of the one on screen.
        key={id}
        testID="shots-next"
        // Without a background it draws nothing: keep Android from flattening it away.
        collapsable={false}
        accessibilityLabel={id}
        style={styles.next}
        onPress={() => setIndex((index + 1) % stories.length)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  next: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 48,
    height: 48,
    // Above the story's own elevated views (app bars, surfaces), which take the touch on Android.
    zIndex: 1000,
    elevation: 1000,
  },
});
