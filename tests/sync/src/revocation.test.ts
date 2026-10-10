import {
  FakeClock,
  buildTestAppStack,
  type TestAppStack,
} from '@mes-courses/mobile/testing';
import { startTestServer, type TestServer } from '@mes-courses/server/testing';

const START = Date.parse('2026-10-06T10:00:00.000Z');

describe('device management against a real server (003 US4)', () => {
  let server: TestServer;
  let clock: FakeClock;

  const tick = () => clock.advance(1_000);
  const newDevice = () => buildTestAppStack({ serverUrl: server.url, clock });
  const cycle = async (stack: TestAppStack) => {
    tick();
    return (await stack.useCases.synchronize()).outcome.type;
  };

  const pairWithPiCode = async (stack: TestAppStack, name: string) => {
    const connected = await stack.useCases.connectToServer(
      server.url,
      await server.createPairingCode(),
      name,
    );
    expect(connected.ok).toBe(true);
  };

  /** A creates a code in the app and B claims it (US4-3, US4-4). */
  const pairWithDeviceCode = async (
    from: TestAppStack,
    stack: TestAppStack,
    name: string,
  ) => {
    const code = await from.useCases.createPairingCode();
    if (!code.ok) throw new Error('no code');
    const connected = await stack.useCases.connectToServer(
      server.url,
      code.value.code,
      name,
    );
    expect(connected.ok).toBe(true);
  };

  const deviceIdOf = async (stack: TestAppStack, name: string) => {
    const devices = await stack.useCases.listDevices();
    if (!devices.ok) throw new Error('no devices');
    const found = devices.value.find((device) => device.name === name);
    if (!found) throw new Error(`no device ${name}`);
    return found;
  };

  const addArticle = async (stack: TestAppStack, name: string) => {
    tick();
    const { list } = await stack.useCases.getCurrentList();
    const [category] = await stack.useCases.getCategories();
    const created = await stack.useCases.createArticleAndAddToList(
      list.id,
      { name, categoryId: category?.id as never },
      null,
    );
    if (!created.ok) throw new Error(`Could not add ${name}`);
  };

  const pendingCount = (stack: TestAppStack) =>
    stack.unitOfWork.run((repos) => repos.changes.count());

  const itemNames = async (stack: TestAppStack) =>
    (await stack.useCases.getCurrentList()).sections.flatMap((section) =>
      section.items.map(({ name }) => name),
    );

  beforeEach(async () => {
    clock = new FakeClock(START);
    server = await startTestServer({ clock });
  });

  afterEach(async () => {
    await server.close();
  });

  it('003 US4-3 / US4-4 a device pairs with a code made by a connected one', async () => {
    const a = await newDevice();
    const b = await newDevice();
    await pairWithPiCode(a, 'Pixel de A');

    await pairWithDeviceCode(a, b, 'iPhone de B');

    const devices = await a.useCases.listDevices();
    expect(devices.ok && devices.value.map((d) => d.name).sort()).toEqual([
      'Pixel de A',
      'iPhone de B',
    ]);
    expect(
      devices.ok &&
        devices.value.filter((d) => d.isThisDevice).map((d) => d.name),
    ).toEqual(['Pixel de A']);
    expect(await cycle(b)).toBe('saved');
  });

  it('003 US4-9 / US4-10 / SC-009 a revoked device is refused, keeps its data and pairs again', async () => {
    const a = await newDevice();
    const b = await newDevice();
    await pairWithPiCode(a, 'Pixel de A');
    await pairWithDeviceCode(a, b, 'iPhone de B');
    expect(await cycle(a)).toBe('saved');
    expect(await cycle(b)).toBe('saved');

    const target = await deviceIdOf(a, 'iPhone de B');
    expect(await a.useCases.revokeDevice(target.id)).toEqual({
      ok: true,
      value: undefined,
    });
    await addArticle(b, 'Houmous');

    expect(await cycle(b)).toBe('disconnectedByServer');
    expect(await itemNames(b)).toContain('Houmous');
    expect(await pendingCount(b)).toBeGreaterThan(0);
    expect((await b.useCases.getSyncInfo()).connection).toBe('connected');

    await pairWithDeviceCode(a, b, 'iPhone de B');
    expect(await cycle(b)).toBe('saved');
    expect(await pendingCount(b)).toBe(0);
    expect(await cycle(a)).toBe('saved');
    expect(await itemNames(a)).toContain('Houmous');
  });

  it('003 US4-11 a device disconnects itself and the server data is untouched', async () => {
    const a = await newDevice();
    const b = await newDevice();
    await pairWithPiCode(a, 'Pixel de A');
    await pairWithDeviceCode(a, b, 'iPhone de B');
    await addArticle(a, 'Pain');
    expect(await cycle(a)).toBe('saved');
    expect(await cycle(b)).toBe('saved');
    await addArticle(b, 'Lait');

    await b.useCases.disconnect();

    expect((await b.useCases.getSyncInfo()).connection).toBe('notConnected');
    expect(await b.credentials.read()).toBeNull();
    expect(await itemNames(b)).toEqual(
      expect.arrayContaining(['Pain', 'Lait']),
    );
    expect(await pendingCount(b)).toBeGreaterThan(0);
    expect(await cycle(b)).toBe('notConnected');
    const devices = await a.useCases.listDevices();
    expect(devices.ok && devices.value.map((d) => d.name)).toEqual([
      'Pixel de A',
    ]);
    expect(await cycle(a)).toBe('saved');
    expect(await itemNames(a)).toEqual(['Pain']);
  });

  it('003 US4-12 the sixth wrong code is answered TooManyAttempts', async () => {
    const stack = await newDevice();
    const attempt = () =>
      stack.useCases.connectToServer(server.url, 'WRONG-CODE', 'Pixel');

    const results = [];
    for (let i = 0; i < 6; i += 1) results.push(await attempt());

    expect(results.slice(0, 5)).toEqual(
      Array(5).fill({ ok: false, error: { type: 'InvalidCode' } }),
    );
    expect(results[5]).toEqual({
      ok: false,
      error: { type: 'TooManyAttempts', minutesToWait: expect.any(Number) },
    });
    expect((await stack.useCases.getSyncInfo()).connection).toBe(
      'notConnected',
    );
  });
});
