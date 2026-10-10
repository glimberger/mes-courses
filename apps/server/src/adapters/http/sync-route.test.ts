import type { Change, Hlc, SyncResponse } from '@mes-courses/sync-core';

import type { Clock } from '../../application/ports/clock';
import { createPairingCode } from '../../application/use-cases/create-pairing-code';
import { buildTestApp } from '../../testing/start-test-server';

const START = Date.parse('2026-10-01T10:00:00.000Z');

class FakeClock implements Clock {
  ms = START;
  nowMs() {
    return this.ms;
  }
}

const hlc = (wallMs: number, deviceId = 'device-1'): Hlc => ({
  wallMs,
  counter: 0,
  deviceId,
});

const bearer = (credential: string) => ({
  authorization: `Bearer ${credential}`,
});

const createList = (changeId: string, id: string, name: string): Change => ({
  changeId,
  hlc: hlc(START - 1000),
  kind: 'list',
  id,
  fields: { name },
});

const harness = () => {
  const clock = new FakeClock();
  const { app, deps, store, db } = buildTestApp({ clock });
  const pair = async () => {
    const { code } = await createPairingCode(deps, null);
    const claim = await app.inject({
      method: 'POST',
      url: '/v1/pairing/claim',
      payload: { code, deviceName: 'Phone' },
    });
    return claim.json() as { deviceId: string; credential: string };
  };
  const post = (credential: string, payload: unknown) =>
    app.inject({
      method: 'POST',
      url: '/v1/sync',
      headers: bearer(credential),
      payload: payload as object,
    });
  return { app, db, store, clock, pair, post };
};

describe('POST /v1/sync', () => {
  it('answers 401 without a credential and 401 for a revoked device', async () => {
    const { app, store, pair, post } = harness();
    const { deviceId, credential } = await pair();
    const body = { lastSeq: 0, hlc: hlc(START), changes: [] };

    const anonymous = await app.inject({
      method: 'POST',
      url: '/v1/sync',
      payload: body,
    });
    await store.run(async ({ devices }) => {
      const device = await devices.get(deviceId);
      if (device === null) throw new Error('device missing');
      await devices.update({
        ...device,
        revokedAt: '2026-10-01T10:00:01.000Z',
      });
    });
    const revoked = await post(credential, body);

    expect(anonymous.statusCode).toBe(401);
    expect(revoked.statusCode).toBe(401);
    expect(revoked.json()).toMatchObject({ error: 'DeviceNotAuthorized' });
  });

  it.each([
    ['a missing lastSeq', { hlc: hlc(START), changes: [] }],
    ['a negative lastSeq', { lastSeq: -1, hlc: hlc(START), changes: [] }],
    ['a missing hlc', { lastSeq: 0, changes: [] }],
    [
      'a change of an unknown kind',
      {
        lastSeq: 0,
        hlc: hlc(START),
        changes: [
          { changeId: 'c', hlc: hlc(START), kind: 'tag', id: 'x', fields: {} },
        ],
      },
    ],
    [
      'a change without changeId',
      {
        lastSeq: 0,
        hlc: hlc(START),
        changes: [{ hlc: hlc(START), kind: 'list', id: 'l', fields: {} }],
      },
    ],
    [
      'a field of the wrong type',
      {
        lastSeq: 0,
        hlc: hlc(START),
        changes: [
          {
            changeId: 'c',
            hlc: hlc(START),
            kind: 'list',
            id: 'l',
            fields: { name: 42 },
          },
        ],
      },
    ],
    [
      'more than 500 changes',
      {
        lastSeq: 0,
        hlc: hlc(START),
        changes: Array.from({ length: 501 }, (_, i) =>
          createList(`c-${i}`, `l-${i}`, `Liste ${i}`),
        ),
      },
    ],
  ])('answers 400 for %s and applies nothing', async (_label, body) => {
    const { store, pair, post } = harness();
    const { credential } = await pair();

    const response = await post(credential, body);

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'BadRequest' });
    expect(await store.run(({ meta }) => meta.currentSeq())).toBe(0);
  });

  it('rejects the whole body when one change breaks the schema', async () => {
    const { store, pair, post } = harness();
    const { credential } = await pair();

    const response = await post(credential, {
      lastSeq: 0,
      hlc: hlc(START),
      changes: [
        createList('c-1', 'l-1', 'Première'),
        { changeId: 'c-2', kind: 'list', id: 'l-2', fields: { name: 'x' } },
      ],
    });

    expect(response.statusCode).toBe(400);
    expect(await store.run(({ lists }) => lists.get('l-1'))).toBeNull();
  });

  it('round-trips: pushes a change and another device pulls it', async () => {
    const { pair, post, clock } = harness();
    const first = await pair();
    const second = await pair();

    const pushed = await post(first.credential, {
      lastSeq: 0,
      hlc: hlc(START),
      changes: [createList('c-1', 'l-1', 'Ma liste')],
    });
    clock.ms += 5000;
    const pulled = await post(second.credential, {
      lastSeq: 0,
      hlc: hlc(START + 5000, second.deviceId),
      changes: [],
    });

    expect(pushed.statusCode).toBe(200);
    const pushedBody = pushed.json() as SyncResponse;
    expect(pushedBody.acknowledged).toEqual(['c-1']);
    expect(pushedBody).toEqual(
      expect.objectContaining({
        serverId: expect.any(String),
        apiVersion: 1,
        minAppVersion: '1.0.0',
      }),
    );
    expect(pulled.statusCode).toBe(200);
    const pulledBody = pulled.json() as SyncResponse;
    expect(pulledBody.rows).toEqual([
      expect.objectContaining({
        kind: 'list',
        id: 'l-1',
        fields: { name: { value: 'Ma liste', hlc: hlc(START - 1000) } },
        createdHlc: hlc(START - 1000),
        deletedHlc: null,
        mergedInto: null,
      }),
    ]);
    expect(pulledBody.seq).toBe(pushedBody.seq);
  });

  it('answers a replay with the same acknowledgement and no second effect', async () => {
    const { pair, post, store } = harness();
    const { credential } = await pair();
    const body = {
      lastSeq: 0,
      hlc: hlc(START),
      changes: [createList('c-1', 'l-1', 'Ma liste')],
    };

    await post(credential, body);
    const replay = await post(credential, body);

    expect((replay.json() as SyncResponse).acknowledged).toEqual(['c-1']);
    expect(await store.run(({ meta }) => meta.currentSeq())).toBe(1);
  });

  it('records the last sync time of the device', async () => {
    const { pair, post, store, clock } = harness();
    const { deviceId, credential } = await pair();
    clock.ms = Date.parse('2026-10-01T11:00:00.000Z');

    await post(credential, { lastSeq: 0, hlc: hlc(clock.ms), changes: [] });

    const device = await store.run(({ devices }) => devices.get(deviceId));
    expect(device?.lastSyncAt).toBe('2026-10-01T11:00:00.000Z');
  });
});
