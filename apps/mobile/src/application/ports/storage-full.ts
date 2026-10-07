/**
 * The device has no room left to save. Expected, so shown to the user and not reported (FR-030).
 * It carries no other field, so no stored value can reach a report.
 */
export class StorageFull extends Error {
  constructor() {
    super('Storage operation failed');
    this.name = 'StorageFull';
  }
}
