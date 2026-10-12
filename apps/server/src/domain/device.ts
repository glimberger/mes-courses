export const DEVICE_NAME_MAX = 60;

/** The trimmed name, or `null` when it is not 1–60 characters. */
export const cleanDeviceName = (name: string): string | null => {
  const trimmed = name.trim();
  return trimmed.length >= 1 && trimmed.length <= DEVICE_NAME_MAX
    ? trimmed
    : null;
};
