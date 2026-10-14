import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { by, device, element } from 'detox';

import { parseStoryList, shotPath, type Scheme } from './names';

// Captures every story (or those of a list) of the screenshot build, once per color scheme.
//   SHOTS_OUT      output folder (default: artifacts/shots)
//   SHOTS_STORIES  file with one story id per line (default: every story)
//   SHOTS_SCHEMES  comma-separated, light and/or dark (default: light,dark)
// With SHOTS_STORIES the walk stops once every listed story is captured.
// The build shows one story at a time; `shots-next` moves to the next and is labelled with the
// id of the story on screen (apps/mobile/src/adapters/ui/testing/story-shots.tsx).

const OUT = path.resolve(process.env.SHOTS_OUT ?? 'artifacts/shots');
const WANTED = process.env.SHOTS_STORIES
  ? parseStoryList(readFileSync(process.env.SHOTS_STORIES, 'utf8'))
  : null;
const SCHEMES = (process.env.SHOTS_SCHEMES ?? 'light,dark').split(
  ',',
) as Scheme[];

const next = () => element(by.id('shots-next'));

const currentId = async (): Promise<string> => {
  const attributes = await next().getAttributes();
  if ('elements' in attributes)
    throw new Error('More than one story on screen');
  if (!attributes.label) throw new Error('The story on screen has no id');
  return attributes.label;
};

/**
 * Moves to the next story. Detox's own tap leaves the transparent control unanswered on Android,
 * where a touch sent by `adb` at its centre works.
 */
const advance = async () => {
  if (device.getPlatform() === 'ios') {
    await next().tap();
    return;
  }
  const attributes = await next().getAttributes();
  if ('elements' in attributes)
    throw new Error('More than one story on screen');
  const { x, y, width, height } = attributes.frame;
  execFileSync('adb', [
    '-s',
    device.id,
    'shell',
    'input',
    'tap',
    String(Math.round(x + width / 2)),
    String(Math.round(y + height / 2)),
  ]);
};

/** Sets the system appearance of the device the app runs on. */
const setScheme = (scheme: Scheme) => {
  if (device.getPlatform() === 'ios') {
    execFileSync('xcrun', ['simctl', 'ui', device.id, 'appearance', scheme]);
  } else {
    execFileSync('adb', [
      '-s',
      device.id,
      'shell',
      'cmd',
      'uimode',
      'night',
      scheme === 'dark' ? 'yes' : 'no',
    ]);
  }
};

/** The stories stay on screen once the story's store is built; give them that moment. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 600));

describe('story screenshots', () => {
  const platform = device.getPlatform();
  const captured: Record<string, string[]> = {};
  // Every story the walk went through, captured or not: tells a walk that did not move.
  const walkedBy: Record<string, string[]> = {};

  for (const scheme of SCHEMES) {
    it(`captures the stories in the ${scheme} scheme`, async () => {
      setScheme(scheme);
      await device.launchApp({ newInstance: true });
      // Loading stories animate for ever, which Detox counts as the app being busy: the settle
      // delay below replaces its synchronization.
      await device.disableSynchronization();
      if (platform === 'ios') {
        await device.setStatusBar({ time: '09:41', batteryLevel: '100' });
      }

      const seen: string[] = [];
      const walked: string[] = [];
      const first = await currentId();
      let id = first;
      do {
        walked.push(id);
        if (WANTED === null || WANTED.includes(id)) {
          // Only a story to capture waits for the settle delay; the others are walked through.
          await settle();
          const taken = await device.takeScreenshot(`${scheme}-${seen.length}`);
          const target = path.join(OUT, shotPath({ platform, scheme, id }));
          mkdirSync(path.dirname(target), { recursive: true });
          renameSync(taken, target);
          seen.push(id);
        }
        // Every listed story is captured: no need to walk back to the first one.
        if (
          WANTED !== null &&
          WANTED.every((wanted) => seen.includes(wanted))
        ) {
          break;
        }
        await advance();
        // The new story's control is mounted by the next render.
        await new Promise((resolve) => setTimeout(resolve, 150));
        id = await currentId();
      } while (id !== first);

      captured[scheme] = seen;
      walkedBy[scheme] = walked;
      const missing = (WANTED ?? []).filter((wanted) => !seen.includes(wanted));
      // A listed story the build does not have is a stale list, not a story to skip.
      if (missing.length > 0) {
        throw new Error(`Stories not in the build: ${missing.join(', ')}`);
      }
    });
  }

  afterAll(() => {
    mkdirSync(OUT, { recursive: true });
    writeFileSync(
      path.join(OUT, `manifest-${platform}.json`),
      `${JSON.stringify({ platform, captured, walked: walkedBy }, null, 2)}\n`,
    );
  });
});
