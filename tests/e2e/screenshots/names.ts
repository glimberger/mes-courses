export type Platform = 'ios' | 'android';
export type Scheme = 'light' | 'dark';

/** `Screens/SignIn/Default` is `Screens-SignIn-Default.png`: the id can be read back from it. */
export const storyFileName = (id: string): string => {
  if (!/^[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*$/.test(id)) {
    throw new Error(`Invalid story id: "${id}"`);
  }
  return `${id.replaceAll('/', '-')}.png`;
};

/** Where a capture goes, below the output folder: `<platform>-<scheme>/<story>.png`. */
export const shotPath = ({
  platform,
  scheme,
  id,
}: {
  platform: Platform;
  scheme: Scheme;
  id: string;
}): string => `${platform}-${scheme}/${storyFileName(id)}`;

/**
 * The stories to capture, one id per line (blank lines and `#` comments ignored). An empty list
 * returns `null`: every story.
 */
export const parseStoryList = (text: string): string[] | null => {
  const ids = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));
  return ids.length === 0 ? null : ids;
};
