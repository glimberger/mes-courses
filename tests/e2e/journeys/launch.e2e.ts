import { by, device, element, expect } from 'detox';

// Proves the build, install and launch chain. first-launch.e2e.ts replaces it in US1.
describe('launch', () => {
  beforeAll(async () => {
    await device.launchApp({ delete: true, newInstance: true });
  });

  it('shows the text of the scaffold screen', async () => {
    await expect(
      element(by.text('Open up App.tsx to start working on your app!')),
    ).toBeVisible();
  });
});
