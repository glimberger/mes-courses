import { err, ok } from '../../domain/result';
import { InMemoryCredentialStore } from '../testing/in-memory-credential-store';
import {
  InMemoryRepositories,
  InMemoryUnitOfWork,
} from '../testing/in-memory-repositories';
import { currentConnection } from './connection';

const FIXED_URL = 'https://courses.example.fr';

describe('currentConnection', () => {
  const setUp = async (state: {
    serverUrl: string | null;
    deviceId: string | null;
    credential: string | null;
  }) => {
    const unitOfWork = new InMemoryUnitOfWork(new InMemoryRepositories());
    const credentials = new InMemoryCredentialStore();
    if (state.credential !== null) await credentials.write(state.credential);
    await unitOfWork.run(async (repos) => {
      await repos.syncState.save({
        ...(await repos.syncState.get()),
        serverUrl: state.serverUrl,
        deviceId: state.deviceId,
      });
    });
    return currentConnection({ unitOfWork, credentials, serverUrl: FIXED_URL });
  };

  it('013 uses the fixed address, not the stored one', async () => {
    expect(
      await setUp({
        serverUrl: 'https://old.example.fr',
        deviceId: 'device-1',
        credential: 'secret',
      }),
    ).toEqual(
      ok({ url: FIXED_URL, deviceId: 'device-1', credential: 'secret' }),
    );
  });

  it('013 connects a paired device with no stored address', async () => {
    expect(
      await setUp({
        serverUrl: null,
        deviceId: 'device-1',
        credential: 'secret',
      }),
    ).toEqual(
      ok({ url: FIXED_URL, deviceId: 'device-1', credential: 'secret' }),
    );
  });

  it('is not connected without a device id', async () => {
    expect(
      await setUp({
        serverUrl: 'https://old.example.fr',
        deviceId: null,
        credential: 'secret',
      }),
    ).toEqual(err({ type: 'DeviceNotAuthorized' }));
  });

  it('FR-018b is not connected without a credential', async () => {
    expect(
      await setUp({
        serverUrl: 'https://old.example.fr',
        deviceId: 'device-1',
        credential: null,
      }),
    ).toEqual(err({ type: 'DeviceNotAuthorized' }));
  });
});
