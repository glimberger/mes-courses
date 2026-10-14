import { parseStoryList, shotPath, storyFileName } from './names';

describe('story screenshot names', () => {
  it('turns a story id into a file name by replacing the slashes', () => {
    expect(storyFileName('Screens/SignIn/InvalidCredentials')).toBe(
      'Screens-SignIn-InvalidCredentials.png',
    );
  });

  it('keeps the platform and the scheme in the folder', () => {
    expect(
      shotPath({
        platform: 'ios',
        scheme: 'dark',
        id: 'Screens/SignIn/Default',
      }),
    ).toBe('ios-dark/Screens-SignIn-Default.png');
  });

  it('refuses an id that would leave its folder', () => {
    expect(() => storyFileName('../Evil')).toThrow('Invalid story id');
    expect(() => storyFileName('Screens//Default')).toThrow('Invalid story id');
    expect(() => storyFileName('')).toThrow('Invalid story id');
  });
});

describe('the list of stories to capture', () => {
  it('reads one id per line, ignoring blank lines and comments', () => {
    expect(
      parseStoryList('Screens/A/One\n\n# a comment\n  Screens/B/Two  \n'),
    ).toEqual(['Screens/A/One', 'Screens/B/Two']);
  });

  it('means every story when the list is empty', () => {
    expect(parseStoryList('')).toBeNull();
    expect(parseStoryList('\n# nothing\n')).toBeNull();
  });
});
