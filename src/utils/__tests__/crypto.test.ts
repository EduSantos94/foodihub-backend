import { describe, it, expect, afterEach, vi } from 'vitest';
import { encryptSecret, decryptSecret, isEncrypted, encryptedColumn } from '../crypto.js';

describe('crypto utils', () => {
  const original = { key: process.env.INTEGRATION_ENCRYPTION_KEY, env: process.env.NODE_ENV };

  afterEach(() => {
    if (original.key === undefined) delete process.env.INTEGRATION_ENCRYPTION_KEY;
    else process.env.INTEGRATION_ENCRYPTION_KEY = original.key;
    process.env.NODE_ENV = original.env;
  });

  it('should round-trip a secret and never store it in plain text', () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = 'k1';
    const enc = encryptSecret('my-api-key');
    expect(enc).not.toContain('my-api-key');
    expect(isEncrypted(enc)).toBe(true);
    expect(decryptSecret(enc)).toBe('my-api-key');
  });

  it('should use a fresh IV every time', () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = 'k1';
    expect(encryptSecret('x')).not.toBe(encryptSecret('x'));
  });

  it('should fail to decrypt with another key or tampered data', () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = 'k1';
    const enc = encryptSecret('secret');
    process.env.INTEGRATION_ENCRYPTION_KEY = 'k2';
    expect(() => decryptSecret(enc)).toThrow();

    process.env.INTEGRATION_ENCRYPTION_KEY = 'k1';
    const parts = enc.split(':');
    parts[parts.length - 1] = Buffer.from('tampered').toString('base64url');
    expect(() => decryptSecret(parts.join(':'))).toThrow();
  });

  it('should pass legacy plaintext through on read', () => {
    expect(decryptSecret('legacy-plain-value')).toBe('legacy-plain-value');
  });

  it('should not double-encrypt and should keep null/undefined/empty', () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = 'k1';
    const enc = encryptedColumn.to('abc') as string;
    expect(encryptedColumn.to(enc)).toBe(enc);
    expect(encryptedColumn.to(undefined)).toBeUndefined();
    expect(encryptedColumn.to(null)).toBeNull();
    expect(encryptedColumn.to('')).toBe('');
    expect(encryptedColumn.from(enc)).toBe('abc');
    expect(encryptedColumn.from(null)).toBeNull();
  });

  it('should require the key in production', () => {
    delete process.env.INTEGRATION_ENCRYPTION_KEY;
    process.env.NODE_ENV = 'production';
    expect(() => encryptSecret('x')).toThrow('INTEGRATION_ENCRYPTION_KEY is required');
  });

  it('should fall back to a dev key (with a warning) outside production', () => {
    delete process.env.INTEGRATION_ENCRYPTION_KEY;
    process.env.NODE_ENV = 'development';
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(decryptSecret(encryptSecret('x'))).toBe('x');
  });
});
