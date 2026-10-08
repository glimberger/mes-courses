/** Names quoted and joined the French way: "« A »", "« A » et « B »", "« A », « B » et « C »". */
export const joinFrench = (names: string[]): string => {
  const quoted = names.map((name) => `« ${name} »`);
  const last = quoted.pop();
  if (last === undefined) return '';
  return quoted.length === 0 ? last : `${quoted.join(', ')} et ${last}`;
};
