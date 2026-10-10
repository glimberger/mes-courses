import { createPairingCode } from '../../application/use-cases/create-pairing-code';
import { buildTestApp } from '../../testing/start-test-server';

const harness = () => {
  const { app, deps, db } = buildTestApp();
  const pair = async (deviceName: string) => {
    const { code } = await createPairingCode(deps, null);
    const claim = await app.inject({
      method: 'POST',
      url: '/v1/pairing/claim',
      payload: { code, deviceName },
    });
    return claim.json() as { deviceId: string; credential: string };
  };
  const as = (credential: string) => ({
    authorization: `Bearer ${credential}`,
  });
  return { app, db, pair, as };
};

describe('device routes', () => {
  it('require a device credential', async () => {
    const { app, db } = harness();

    for (const [method, url] of [
      ['GET', '/v1/devices'],
      ['PATCH', '/v1/devices/x'],
      ['DELETE', '/v1/devices/x'],
    ] as const) {
      const response = await app.inject({ method, url, payload: undefined });
      expect(response.statusCode).toBe(401);
      expect(response.json().error).toBe('DeviceNotAuthorized');
    }
    db.close();
  });

  it('GET /v1/devices lists the authorized devices', async () => {
    const { app, db, pair, as } = harness();
    const a = await pair('Pixel');
    const b = await pair('iPhone');

    const response = await app.inject({
      method: 'GET',
      url: '/v1/devices',
      headers: as(a.credential),
    });

    expect(response.statusCode).toBe(200);
    const { devices } = response.json() as {
      devices: Array<{ id: string; name: string; lastSyncAt: null }>;
    };
    expect(devices.map((d) => d.id).sort()).toEqual(
      [a.deviceId, b.deviceId].sort(),
    );
    expect(devices[0]).not.toHaveProperty('credentialHash');
    db.close();
  });

  it('PATCH /v1/devices/:id renames, 400 on a bad name, 404 when unknown', async () => {
    const { app, db, pair, as } = harness();
    const a = await pair('Pixel');
    const url = `/v1/devices/${a.deviceId}`;

    const ok = await app.inject({
      method: 'PATCH',
      url,
      headers: as(a.credential),
      payload: { name: ' Pixel de Marie ' },
    });
    const bad = await app.inject({
      method: 'PATCH',
      url,
      headers: as(a.credential),
      payload: { name: '' },
    });
    const missing = await app.inject({
      method: 'PATCH',
      url: '/v1/devices/unknown',
      headers: as(a.credential),
      payload: { name: 'Name' },
    });

    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ id: a.deviceId, name: 'Pixel de Marie' });
    expect(bad.statusCode).toBe(400);
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error).toBe('NotFound');
    db.close();
  });

  it('DELETE /v1/devices/:id revokes: 204, then 401 for that device (SC-009)', async () => {
    const { app, db, pair, as } = harness();
    const a = await pair('Pixel');
    const b = await pair('iPhone');

    const revoked = await app.inject({
      method: 'DELETE',
      url: `/v1/devices/${b.deviceId}`,
      headers: as(a.credential),
    });
    const afterwards = await app.inject({
      method: 'GET',
      url: '/v1/devices',
      headers: as(b.credential),
    });
    const again = await app.inject({
      method: 'DELETE',
      url: `/v1/devices/${b.deviceId}`,
      headers: as(a.credential),
    });

    expect(revoked.statusCode).toBe(204);
    expect(afterwards.statusCode).toBe(401);
    expect(again.statusCode).toBe(404);
    db.close();
  });

  it('003 US4-11 a device may revoke itself', async () => {
    const { app, db, pair, as } = harness();
    const a = await pair('Pixel');

    const response = await app.inject({
      method: 'DELETE',
      url: `/v1/devices/${a.deviceId}`,
      headers: as(a.credential),
    });

    expect(response.statusCode).toBe(204);
    db.close();
  });
});
