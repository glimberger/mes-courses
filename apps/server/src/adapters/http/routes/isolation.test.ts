import type { Change, Hlc, ServerRow } from '@mes-courses/sync-core';

import { buildTestApp } from '../../../testing/start-test-server';

type Bed = ReturnType<typeof buildTestApp>;

let counter = 0;
const hlcOf = (deviceId: string): Hlc => ({
  wallMs: Date.now(),
  counter: (counter += 1),
  deviceId,
});

const bearer = (credential: string) => ({
  authorization: `Bearer ${credential}`,
});

const post = async (bed: Bed, credential: string, changes: Change[]) => {
  const response = await bed.app.inject({
    method: 'POST',
    url: '/v1/sync',
    headers: bearer(credential),
    payload: { lastSeq: 0, hlc: hlcOf('d'), changes },
  });
  return {
    status: response.statusCode,
    body: response.json() as {
      acknowledged: string[];
      rows: ServerRow[];
      seq: number;
    },
  };
};

/** The same ids in both accounts, on purpose: only the account tells them apart. */
const SHARED = { category: 'cat-1', article: 'art-1', list: 'list-1' };

const seedChanges = (prefix: string, articleName: string): Change[] => [
  {
    changeId: `${prefix}-1`,
    hlc: hlcOf(prefix),
    kind: 'category',
    id: SHARED.category,
    fields: { name: `Rayon ${prefix}`, position: 0 },
  },
  {
    changeId: `${prefix}-2`,
    hlc: hlcOf(prefix),
    kind: 'article',
    id: SHARED.article,
    fields: { name: articleName, categoryId: SHARED.category },
  },
  {
    changeId: `${prefix}-3`,
    hlc: hlcOf(prefix),
    kind: 'list',
    id: SHARED.list,
    fields: { name: `Liste ${prefix}` },
  },
];

const setup = async () => {
  const bed = buildTestApp();
  const a = await bed.createAccount({ email: 'a@example.org' });
  const b = await bed.createAccount({ email: 'b@example.org' });
  return { bed, a, b };
};

const names = (rows: ServerRow[]) =>
  rows
    .map((row) => {
      const name = (row.fields as { name?: { value: string } }).name;
      return `${row.kind}:${row.id}:${name?.value ?? ''}`;
    })
    .sort();

describe('data separation through the HTTP routes (004 US3)', () => {
  it('004 US3-3 colliding ids create separate rows in each account', async () => {
    const { bed, a, b } = await setup();

    await post(bed, b.deviceCredential, seedChanges('b', 'Beurre'));
    const afterA = await post(
      bed,
      a.deviceCredential,
      seedChanges('a', 'Lait'),
    );

    expect(names(afterA.body.rows)).toEqual([
      'article:art-1:Lait',
      'category:cat-1:Rayon a',
      'list:list-1:Liste a',
    ]);
    const againB = await post(bed, b.deviceCredential, []);
    expect(names(againB.body.rows)).toEqual([
      'article:art-1:Beurre',
      'category:cat-1:Rayon b',
      'list:list-1:Liste b',
    ]);
    bed.db.close();
  });

  it("004 US3-3 changes naming another account's ids are acknowledged and read or change nothing there", async () => {
    const { bed, a, b } = await setup();
    await post(bed, b.deviceCredential, [
      ...seedChanges('b', 'Beurre'),
      {
        changeId: 'b-4',
        hlc: hlcOf('b'),
        kind: 'listItem',
        id: `${SHARED.list}:${SHARED.article}`,
        fields: {
          listId: SHARED.list,
          articleId: SHARED.article,
          present: true,
          inCart: false,
          quantity: null,
        },
      },
    ]);
    const before = await post(bed, b.deviceCredential, []);

    // A knows none of these ids: updates and an item pointing at B's article.
    const foreign: Change[] = [
      {
        changeId: 'a-1',
        hlc: hlcOf('a'),
        kind: 'article',
        id: SHARED.article,
        fields: { name: 'Piraté' },
      },
      {
        changeId: 'a-2',
        hlc: hlcOf('a'),
        kind: 'category',
        id: SHARED.category,
        fields: { name: 'Piraté' },
      },
      {
        changeId: 'a-3',
        hlc: hlcOf('a'),
        kind: 'listItem',
        id: `${SHARED.list}:${SHARED.article}`,
        fields: { inCart: true },
      },
      {
        changeId: 'a-4',
        hlc: hlcOf('a'),
        kind: 'article',
        id: SHARED.article,
        fields: { deleted: true },
      },
    ];
    const sent = await post(bed, a.deviceCredential, foreign);

    expect(sent.status).toBe(200);
    expect(sent.body.acknowledged).toEqual(['a-1', 'a-2', 'a-3', 'a-4']);
    expect(
      sent.body.rows.filter((row) => JSON.stringify(row).includes('Beurre')),
    ).toEqual([]);
    const after = await post(bed, b.deviceCredential, []);
    expect(after.body.rows).toEqual(before.body.rows);
    bed.db.close();
  });

  it('004 US3-3 an applied change id of another account is never taken for a replay', async () => {
    const { bed, a, b } = await setup();
    await post(bed, b.deviceCredential, [
      {
        changeId: 'same-change-id',
        hlc: hlcOf('b'),
        kind: 'list',
        id: 'list-b',
        fields: { name: 'Chez B' },
      },
    ]);

    const response = await post(bed, a.deviceCredential, [
      {
        changeId: 'same-change-id',
        hlc: hlcOf('a'),
        kind: 'list',
        id: 'list-a',
        fields: { name: 'Chez A' },
      },
    ]);

    expect(names(response.body.rows)).toEqual(['list:list-a:Chez A']);
    bed.db.close();
  });

  it("004 US3-3 another account's device id answers 404 on rename and revoke, and the list holds only the caller's", async () => {
    const { bed, a, b } = await setup();
    const [bDevice] = await bed.store.run(({ devices }) =>
      devices.forAccount(b.accountId),
    );
    if (!bDevice) throw new Error('B has no device');

    const rename = await bed.app.inject({
      method: 'PATCH',
      url: `/v1/devices/${bDevice.id}`,
      headers: bearer(a.deviceCredential),
      payload: { name: 'Volé' },
    });
    const revoke = await bed.app.inject({
      method: 'DELETE',
      url: `/v1/devices/${bDevice.id}`,
      headers: bearer(a.deviceCredential),
    });
    const list = await bed.app.inject({
      method: 'GET',
      url: '/v1/devices',
      headers: bearer(a.deviceCredential),
    });

    expect(rename.statusCode).toBe(404);
    expect(rename.json()).toEqual(
      expect.objectContaining({ error: 'NotFound' }),
    );
    expect(revoke.statusCode).toBe(404);
    expect(list.statusCode).toBe(200);
    expect(
      (list.json() as { devices: { id: string }[] }).devices.map((d) => d.id),
    ).not.toContain(bDevice.id);
    // B's device is untouched and still works.
    const still = await post(bed, b.deviceCredential, []);
    expect(still.status).toBe(200);
    bed.db.close();
  });
});
