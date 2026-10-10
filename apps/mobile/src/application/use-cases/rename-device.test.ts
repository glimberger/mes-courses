import { err, ok } from '../../domain/result';
import { conn, pairedDevice } from '../testing/paired-device';
import { createRenameDevice } from './rename-device';

describe('renameDevice', () => {
  it('sends the cleaned name', async () => {
    const { unitOfWork, credentials, syncServer, calls } = await pairedDevice();

    const result = await createRenameDevice({
      unitOfWork,
      credentials,
      syncServer,
    })('device-2', '  Pixel   de Marie ');

    expect(result).toEqual(ok(undefined));
    expect(calls).toEqual([
      ['renameDevice', conn, 'device-2', 'Pixel de Marie'],
    ]);
  });

  it('returns 001 validateName errors and sends nothing', async () => {
    const { unitOfWork, credentials, syncServer, calls } = await pairedDevice();
    const rename = createRenameDevice({ unitOfWork, credentials, syncServer });

    expect(await rename('device-2', '   ')).toEqual(
      err({ type: 'NameRequired' }),
    );
    expect(await rename('device-2', 'x'.repeat(61))).toEqual(
      err({ type: 'NameTooLong' }),
    );
    expect(calls).toEqual([]);
  });

  it('returns NotFound as it is', async () => {
    const { unitOfWork, credentials, syncServer } = await pairedDevice({
      renameDevice: async () => err({ type: 'NotFound' }),
    });

    expect(
      await createRenameDevice({ unitOfWork, credentials, syncServer })(
        'x',
        'Name',
      ),
    ).toEqual(err({ type: 'NotFound' }));
  });
});
