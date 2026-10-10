import type { DevicesDeps } from './list-devices';
import { NotFoundError } from './not-found';

/**
 * Revokes a device (US4-9). From the next request on it is refused (SC-009). A device may revoke
 * itself, which is how "Déconnecter" works (US4-11).
 */
export const revokeDevice = async (
  { store, clock }: DevicesDeps,
  id: string,
): Promise<void> => {
  const at = new Date(clock.nowMs()).toISOString();
  await store.run(async ({ devices }) => {
    const device = await devices.get(id);
    if (device === null || device.revokedAt !== null) throw new NotFoundError();
    await devices.update({ ...device, revokedAt: at });
  });
};
