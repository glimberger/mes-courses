import {
  composeShotStories,
  StoryShots,
  type ShotStory,
} from '../src/adapters/ui/testing/story-shots';
import preview from './preview';

// Every story of the app, in file order.
const context = require.context('../src/adapters/ui', true, /\.stories\.tsx$/);

const stories: ShotStory[] = context
  .keys()
  .flatMap((key) =>
    composeShotStories(
      context(key) as Parameters<typeof composeShotStories>[0],
      [preview.decorators ?? []].flat(),
    ),
  );

const StoryShotsRoot = () => <StoryShots stories={stories} />;

export default StoryShotsRoot;
