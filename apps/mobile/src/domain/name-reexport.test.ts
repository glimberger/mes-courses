import * as syncCore from '@mes-courses/sync-core';

import { cleanName, normalizedName } from './name';

describe('name re-exports', () => {
  it('R1 cleanName and normalizedName are the shared package ones', () => {
    expect(cleanName).toBe(syncCore.cleanName);
    expect(normalizedName).toBe(syncCore.normalizedName);
  });
});
