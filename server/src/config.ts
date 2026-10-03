// How far to trust X-Forwarded-For. A plain "true" would trust every hop, so the
// client could pick its own address and slip past the per-address limits.
// Accepted: unset or "false" (no proxy), a hop count such as "1", or the proxy
// addresses as a comma-separated IP/CIDR list such as "10.0.0.0/8".
export function parseTrustProxy(value: string | undefined): false | number | string[] {
  const text = (value ?? '').trim();
  if (text === '' || text === 'false') return false;
  if (text === 'true') throw new Error('TRUST_PROXY=true trusts any client. Set the number of proxy hops (e.g. 1) or the proxy IP/CIDR list.');
  if (/^\d+$/.test(text)) return Number(text);
  return text.split(',').map((part) => part.trim()).filter(Boolean);
}
