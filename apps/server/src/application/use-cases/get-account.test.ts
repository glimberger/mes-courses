import { account } from '../testing/contracts/entities';
import { getAccount } from './get-account';

describe('getAccount', () => {
  it('004 US6-1 returns the id, the address and the role', () => {
    expect(
      getAccount(
        account('a-1', 'admin@example.org', { role: 'administrator' }),
      ),
    ).toEqual({ id: 'a-1', email: 'admin@example.org', role: 'administrator' });
  });

  it('004 returns nothing else of the record', () => {
    expect(
      Object.keys(
        getAccount(account('a-1', 'a@example.org', { passwordHash: 'h' })),
      ),
    ).toEqual(['id', 'email', 'role']);
  });
});
