import { describe, it, expect } from 'vitest';
import { pick } from '../pick.js';
import { isValidCnpj, onlyDigits } from '../cnpj.js';

describe('pick', () => {
  it('should keep only listed keys that are defined', () => {
    const body: any = { name: 'x', store_id: 'evil', deleted_at: 'now', active: false, phone: undefined };
    expect(pick(body, ['name', 'active', 'phone'])).toEqual({ name: 'x', active: false });
  });

  it('should keep null (to clear a field) and falsy values', () => {
    expect(pick({ a: null, b: 0, c: '' } as any, ['a', 'b', 'c'])).toEqual({ a: null, b: 0, c: '' });
  });

  it('should tolerate a missing body', () => {
    expect(pick(undefined, ['a'] as any)).toEqual({});
  });
});

describe('cnpj', () => {
  it('should accept valid CNPJs, formatted or not', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true);
    expect(isValidCnpj('11222333000181')).toBe(true);
    expect(isValidCnpj('45.997.418/0001-53')).toBe(true);
  });

  it('should reject wrong check digits, wrong length, repeated digits and garbage', () => {
    expect(isValidCnpj('11.222.333/0001-82')).toBe(false);
    expect(isValidCnpj('1122233300018')).toBe(false);
    expect(isValidCnpj('00000000000000')).toBe(false);
    expect(isValidCnpj('11111111111111')).toBe(false);
    expect(isValidCnpj('abc')).toBe(false);
    expect(isValidCnpj('')).toBe(false);
  });

  it('should strip formatting', () => {
    expect(onlyDigits('11.222.333/0001-81')).toBe('11222333000181');
  });
});
