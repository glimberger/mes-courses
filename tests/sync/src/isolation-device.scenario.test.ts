import { FakeClock, buildTestAppStack } from '@mes-courses/mobile/testing';
import { startTestServer, type TestServer } from '@mes-courses/server/testing';

import {
  LEGACY_CREDENTIAL,
  LEGACY_DEVICE_ID,
  LEGACY_SERVER_ID,
  LEGACY_TABLET_ID,
  legacy003Database,
} from './fixtures/legacy-003';
import { signInDevice } from './testing/onboard';

const START = Date.parse('2026-10-12T10:00:00.000Z');

const itemNames = async (
  stack: Awaited<ReturnType<typeof buildTestAppStack>>,
) =>
  (await stack.useCases.getCurrentList()).sections
    .flatMap((section) => section.items)
    .map((row) => row.name);

describe('devices and migrated data (004 US3)', () => {
  let server: TestServer | undefined;
  let clock: FakeClock;

  beforeEach(() => {
    clock = new FakeClock(START);
  });
  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  it('004 US3-2 a second device of the same user holds exactly their data after its first sync', async () => {
    server = await startTestServer({ clock });
    const phone = await buildTestAppStack({ serverUrl: server.url, clock });
    await signInDevice(server, phone, 'Pixel');
    const { list } = await phone.useCases.getCurrentList();
    const [category] = await phone.useCases.getCategories();
    await phone.useCases.createArticleAndAddToList(
      list.id,
      { name: 'Lait', categoryId: category?.id as never },
      null,
    );
    clock.advance(1000);
    await phone.useCases.synchronize();

    // Someone else's data on the same server must not reach the tablet.
    const other = await buildTestAppStack({ serverUrl: server.url, clock });
    await signInDevice(server, other, 'Autre', 'paul@example.org');
    const otherList = (await other.useCases.getCurrentList()).list;
    const [otherCategory] = await other.useCases.getCategories();
    await other.useCases.createArticleAndAddToList(
      otherList.id,
      { name: 'Bière', categoryId: otherCategory?.id as never },
      null,
    );
    clock.advance(1000);
    await other.useCases.synchronize();

    const tablet = await buildTestAppStack({ serverUrl: server.url, clock });
    expect((await signInDevice(server, tablet, 'Tablette')).ok).toBe(true);
    clock.advance(1000);
    await tablet.useCases.synchronize();

    expect(await itemNames(tablet)).toEqual(['Lait']);
    expect(await itemNames(tablet)).not.toContain('Bière');
    const devices = await tablet.useCases.listDevices();
    expect(devices.ok && devices.value.map((d) => d.name).sort()).toEqual([
      'Pixel',
      'Tablette',
    ]);
  });

  it('004 US3-5 / SC-005 the maintainer device keeps syncing with its old credential after the migration', async () => {
    server = await startTestServer({ clock, database: legacy003Database() });

    // The app as it stood after 003's pairing: a credential, a connection, no account id.
    const phone = await buildTestAppStack({ serverUrl: server.url, clock });
    await phone.credentials.write(LEGACY_CREDENTIAL);
    await phone.database.runAsync(
      `INSERT INTO sync_state (id, server_url, server_id, device_id, account_id, last_seq, max_hlc, last_sync_at, snapshot_done)
       VALUES (1, ?, ?, ?, NULL, 0, '000000000000000-000000-local', NULL, 1)
       ON CONFLICT (id) DO UPDATE SET server_url = excluded.server_url, server_id = excluded.server_id,
         device_id = excluded.device_id, account_id = NULL, last_seq = 0, snapshot_done = 1`,
      [server.url, LEGACY_SERVER_ID, LEGACY_DEVICE_ID],
    );
    expect((await phone.useCases.getSyncInfo()).connection).toBe('connected');

    clock.advance(1000);
    const { outcome } = await phone.useCases.synchronize();

    expect(outcome.type).toBe('saved');
    const lists = await phone.useCases.getLists();
    expect(lists.map((list) => list.name)).toContain('Courses de la semaine');
    const catalog = await phone.useCases.getCategories();
    expect(catalog.map((category) => category.name)).toContain('Crèmerie');

    // The response carried the setup account's id and the app recorded it.
    const info = await phone.database.getFirstAsync<{
      account_id: string | null;
    }>('SELECT account_id FROM sync_state WHERE id = 1', []);
    expect(info?.account_id).toEqual(expect.any(String));

    // The devices list is the same two devices.
    const devices = await phone.useCases.listDevices();
    expect(devices.ok && devices.value.map((d) => d.id).sort()).toEqual(
      [LEGACY_DEVICE_ID, LEGACY_TABLET_ID].sort(),
    );
  });
});
