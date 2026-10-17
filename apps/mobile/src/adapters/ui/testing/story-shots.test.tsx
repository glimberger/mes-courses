import * as Font from 'expo-font';
import { Text } from 'react-native';

import { fireEvent, render, screen } from '@testing-library/react-native';

import { nunitoFontFiles } from '../theme/fonts';
import { composeShotStories, StoryShots, type ShotStory } from './story-shots';

jest.mock('expo-font', () => ({
  loadAsync: jest.fn(() => Promise.resolve()),
}));

const stories: ShotStory[] = [
  { id: 'Screens/A/One', Story: () => <Text>first story</Text> },
  { id: 'Screens/B/Two', Story: () => <Text>second story</Text> },
];

describe('StoryShots', () => {
  it('draws no story before Nunito is loaded, so no capture shows the system font', async () => {
    render(<StoryShots stories={stories} />);

    expect(Font.loadAsync).toHaveBeenCalledWith(nunitoFontFiles);
    expect(screen.queryByText('first story')).toBeNull();
    expect(await screen.findByText('first story')).toBeTruthy();
  });

  it('shows the first story and names it on the control that moves on', async () => {
    render(<StoryShots stories={stories} />);

    expect(await screen.findByText('first story')).toBeTruthy();
    expect(screen.getByTestId('shots-next').props.accessibilityLabel).toBe(
      'Screens/A/One',
    );
  });

  it('shows the next story at each press and comes back to the first after the last', async () => {
    render(<StoryShots stories={stories} />);

    fireEvent.press(await screen.findByTestId('shots-next'));
    expect(screen.getByText('second story')).toBeTruthy();
    expect(screen.getByTestId('shots-next').props.accessibilityLabel).toBe(
      'Screens/B/Two',
    );

    fireEvent.press(screen.getByTestId('shots-next'));
    expect(screen.getByText('first story')).toBeTruthy();
  });

  it('shows nothing, without failing, when there is no story', () => {
    render(<StoryShots stories={[]} />);

    expect(screen.queryByTestId('shots-next')).toBeNull();
  });
});

describe('composeShotStories', () => {
  const Label = ({ text }: { text: string }) => <Text>{text}</Text>;
  const withNote = (
    Story: React.ComponentType,
    { parameters }: { parameters: { note?: string } },
  ) => (
    <>
      <Text>{parameters.note ?? 'no note'}</Text>
      <Story />
    </>
  );

  it('names each story title/export and renders the component with the merged args', () => {
    const [story] = composeShotStories(
      {
        default: {
          title: 'Components/Label',
          component: Label,
          args: { text: 'from the meta' },
        },
        Default: {},
      },
      [],
    );

    expect(story?.id).toBe('Components/Label/Default');
    const { Story } = story as ShotStory;
    render(<Story />);
    expect(screen.getByText('from the meta')).toBeTruthy();
  });

  it('lets a story override the args, and its own render win', () => {
    const [overridden, custom] = composeShotStories(
      {
        default: { title: 'Components/Label', component: Label },
        Overridden: { args: { text: 'from the story' } },
        Custom: { render: () => <Text>custom render</Text> },
      },
      [],
    );

    const { Story: Overridden } = overridden as ShotStory;
    render(<Overridden />);
    expect(screen.getByText('from the story')).toBeTruthy();
    const { Story: Custom } = custom as ShotStory;
    render(<Custom />);
    expect(screen.getByText('custom render')).toBeTruthy();
  });

  it('wraps the story in the decorators, given the merged parameters', () => {
    const [story] = composeShotStories(
      {
        default: {
          title: 'Components/Label',
          component: Label,
          args: { text: 'body' },
          parameters: { note: 'from the meta' },
        },
        Noted: { parameters: { note: 'from the story' } },
      },
      [withNote],
    );

    const { Story } = story as ShotStory;
    render(<Story />);
    expect(screen.getByText('from the story')).toBeTruthy();
    expect(screen.getByText('body')).toBeTruthy();
  });

  it('refuses a file with no title', () => {
    expect(() =>
      composeShotStories({ default: { component: Label }, A: {} }, []),
    ).toThrow('must declare a title');
  });
});
