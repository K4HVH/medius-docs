// A client's address as the rate limits count it. One home network hands out a whole IPv6 /64, so that is one
// client.
export const clientOf = (ip: string): string => {
  const a = ip.split('%')[0].toLowerCase();
  if (!a.includes(':')) return a;
  const v4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(a);
  if (v4) return v4[1];
  const [head, tail] = a.split('::');
  const h = head ? head.split(':') : [];
  const t = tail ? tail.split(':') : [];
  const groups = tail === undefined ? h : [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t];
  return `${groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, '')).join(':')}::/64`;
};
