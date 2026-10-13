import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

const PREFIX = 'enc:v1:';
const DEV_FALLBACK = 'foodihub-dev-only-encryption-key';
let warned = false;

/**
 * 32-byte key from INTEGRATION_ENCRYPTION_KEY (any string; hashed with SHA-256).
 * In production the variable is mandatory; elsewhere a fixed dev key is used with a warning.
 */
function getKey(): Buffer {
  const secret = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (secret) return createHash('sha256').update(secret).digest();

  if (process.env.NODE_ENV === 'production') {
    throw new Error('INTEGRATION_ENCRYPTION_KEY is required in production');
  }
  if (!warned) {
    warned = true;
    console.warn('INTEGRATION_ENCRYPTION_KEY is not set: using an insecure development key');
  }
  return createHash('sha256').update(DEV_FALLBACK).digest();
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}

/** AES-256-GCM. Output: enc:v1:<iv>:<tag>:<ciphertext> (base64url). */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64url')}:${tag.toString('base64url')}:${data.toString('base64url')}`;
}

/** Decrypts values produced by encryptSecret. Values without the prefix (legacy plaintext) pass through. */
export function decryptSecret(value: string): string {
  if (!isEncrypted(value)) return value;
  const [ivB64, tagB64, dataB64] = value.slice(PREFIX.length).split(':');
  const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivB64, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64url')), decipher.final()]).toString('utf8');
}

/** TypeORM column transformer: encrypts on write, decrypts on read. */
export const encryptedColumn = {
  to: (value?: string | null): string | null | undefined =>
    value === undefined || value === null || value === '' ? value : isEncrypted(value) ? value : encryptSecret(value),
  from: (value?: string | null): string | null | undefined =>
    value === undefined || value === null ? value : decryptSecret(value),
};
