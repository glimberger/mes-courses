import { cleanDeviceName } from '../../domain/device';
import { InvalidDeviceNameError } from './invalid-device-name';
import type { DevicesDeps } from './list-devices';
import { NotFoundError } from './not-found';

/** Renames an authorized device; the name is trimmed to 1–60 characters (FR-019c). */
export const renameDevice = async (
  { store }: DevicesDeps,
  accountId: string,
  id: string,
  name: string,
): Promise<{ id: string; name: string }> => {
  const cleaned = cleanDeviceName(name);
  if (cleaned === null) throw new InvalidDeviceNameError();
  return store.run(async ({ devices }) => {
    const device = (await devices.forAccount(accountId)).find(
      (candidate) => candidate.id === id,
    );
    if (device === undefined || device.revokedAt !== null) {
      throw new NotFoundError();
    }
    await devices.update({ ...device, name: cleaned });
    return { id, name: cleaned };
  });
};
