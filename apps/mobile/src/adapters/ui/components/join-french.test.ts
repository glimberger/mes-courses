import { joinFrench } from './join-french';

describe('joinFrench', () => {
  it('quotes one name: ["A"] is "« A »"', () => {
    expect(joinFrench(['A'])).toBe('« A »');
  });

  it('joins two names with "et": "« A » et « B »"', () => {
    expect(joinFrench(['A', 'B'])).toBe('« A » et « B »');
  });

  it('joins three names with commas and a last "et": "« A », « B » et « C »"', () => {
    expect(joinFrench(['A', 'B', 'C'])).toBe('« A », « B » et « C »');
  });
});
