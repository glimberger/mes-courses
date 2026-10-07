/** The stored data was written by a newer version of the app, which must be updated (FR-040). */
export class DataFromNewerVersion extends Error {
  constructor() {
    super('Stored data comes from a newer version');
    this.name = 'DataFromNewerVersion';
  }
}
