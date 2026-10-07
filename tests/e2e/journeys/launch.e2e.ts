import { by, device, element, expect } from 'detox';

// Proves the build, install and launch chain. first-launch.e2e.ts replaces it in US1.
describe('launch', () => {
  beforeAll(async () => {
    await device.launchApp({ delete: true, newInstance: true });
  });

  it('starts on the placeholder of the current list', async () => {
    await expect(element(by.text('Liste en cours'))).toBeVisible();
  });
});
