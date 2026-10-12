/** A device name is not 1–60 characters once trimmed. */
export class InvalidDeviceNameError extends Error {
  constructor() {
    super('InvalidDeviceName');
  }
}
