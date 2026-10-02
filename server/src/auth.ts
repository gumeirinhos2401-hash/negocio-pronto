import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const COST = 16384;
const KEY_LENGTH = 64;

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, { N: COST }, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt$${COST}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, cost, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || Number(cost) !== COST || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const key = await derive(password, Buffer.from(salt, 'base64'));
  return expected.length === key.length && timingSafeEqual(expected, key);
}

// Checked when the email is unknown, so a login attempt costs the same time
// whether or not the account exists.
export const DUMMY_HASH = `scrypt$${COST}$${Buffer.alloc(16).toString('base64')}$${Buffer.alloc(KEY_LENGTH).toString('base64')}`;

export const newSessionToken = (): string => randomBytes(32).toString('base64url');

// Only the hash is stored, so a leaked database does not hand out live sessions.
export const hashSessionToken = (token: string): string => createHash('sha256').update(token).digest('hex');
