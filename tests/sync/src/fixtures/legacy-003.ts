import { createHash } from 'node:crypto';

import { openDatabaseAtVersion1 } from '@mes-courses/server/testing';

const hlc = (wallMs: number, deviceId: string): string =>
  `${String(wallMs).padStart(15, '0')}-${String(0).padStart(6, '0')}-${deviceId}`;

export const LEGACY_SERVER_ID = '11111111-2222-3333-4444-555555555555';
export const LEGACY_DEVICE_ID = 'legacy-phone';
export const LEGACY_TABLET_ID = 'legacy-tablet';
/** The Bearer credential 003's pairing handed the maintainer's phone. */
export const LEGACY_CREDENTIAL = 'legacy-credential-from-pairing-003';

/**
 * A database as migration 1 and 003's code leave it after the maintainer paired two devices and
 * used the app: a category, an article, a list with an item, an applied change, a used pairing
 * code. Only the schema of 003 exists here (no account), as on the Pi before this feature.
 */
export const legacy003Database = () => {
  const db = openDatabaseAtVersion1();
  const stamp = hlc(Date.parse('2026-09-01T10:00:00.000Z'), LEGACY_DEVICE_ID);
  db.run('UPDATE meta SET server_id = ?, seq = 4', [LEGACY_SERVER_ID]);
  db.run(
    `INSERT INTO category (id, name, name_hlc, normalized_name, position, position_hlc, created_hlc, seq)
     VALUES ('c-1', 'Crèmerie', ?, 'crèmerie', 0, ?, ?, 1)`,
    [stamp, stamp, stamp],
  );
  db.run(
    `INSERT INTO article (id, name, name_hlc, normalized_name, category_id, category_hlc, created_hlc, seq)
     VALUES ('a-1', 'Lait demi-écrémé', ?, 'lait demi-écrémé', 'c-1', ?, ?, 2)`,
    [stamp, stamp, stamp],
  );
  db.run(
    `INSERT INTO shopping_list (id, name, name_hlc, normalized_name, created_hlc, seq)
     VALUES ('l-1', 'Courses de la semaine', ?, 'courses de la semaine', ?, 3)`,
    [stamp, stamp],
  );
  db.run(
    `INSERT INTO list_item (list_id, article_id, present, present_hlc, in_cart, in_cart_hlc, quantity_amount, quantity_unit, quantity_hlc, seq)
     VALUES ('l-1', 'a-1', 1, ?, 0, ?, 2, 'L', ?, 4)`,
    [stamp, stamp, stamp],
  );
  db.run(
    `INSERT INTO applied_change (change_id, device_id, applied_at) VALUES ('ch-1', ?, '2026-09-01T10:00:00.000Z')`,
    [LEGACY_DEVICE_ID],
  );
  const credentialHash = createHash('sha256')
    .update(LEGACY_CREDENTIAL)
    .digest('hex');
  db.run(
    `INSERT INTO device (id, name, credential_hash, created_at, last_sync_at)
     VALUES (?, 'Téléphone', ?, '2026-09-01T09:00:00.000Z', '2026-09-30T09:00:00.000Z')`,
    [LEGACY_DEVICE_ID, credentialHash],
  );
  db.run(
    `INSERT INTO device (id, name, credential_hash, created_at)
     VALUES (?, 'Tablette', 'hash-of-the-tablet', '2026-09-02T09:00:00.000Z')`,
    [LEGACY_TABLET_ID],
  );
  db.run(
    `INSERT INTO pairing_code (code_hash, created_by, expires_at, used_at)
     VALUES ('code-1', NULL, '2026-09-01T09:10:00.000Z', '2026-09-01T09:05:00.000Z')`,
  );
  return db;
};
