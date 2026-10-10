/** The device does not exist or is already revoked. */
export class NotFoundError extends Error {
  constructor() {
    super('NotFound');
  }
}
