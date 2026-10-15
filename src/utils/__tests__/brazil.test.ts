import { describe, it, expect } from 'vitest';
import { isValidCpf, normalizeBrazilianFields } from '../brazil.js';
import { cleanCnpj, isValidCnpj } from '../cnpj.js';

describe('brazil utils', () => {
  it('validates CPF check digits', () => {
    expect(isValidCpf('111.444.777-35')).toBe(true);
    expect(isValidCpf('11144477735')).toBe(true);
    expect(isValidCpf('11144477736')).toBe(false);
    expect(isValidCpf('11111111111')).toBe(false);
    expect(isValidCpf('1114447773a')).toBe(false);
  });

  it('normalises formatted values to digits and upper-cases the state', () => {
    expect(
      normalizeBrazilianFields({ cnpj: '11.222.333/0001-81', cpf: '111.444.777-35', phone: '(11) 91234-5678', zip_code: '01310-100', state: 'sp' })
    ).toEqual({ cnpj: '11222333000181', cpf: '11144477735', phone: '11912345678', zip_code: '01310100', state: 'SP' });
  });

  it('leaves absent and empty fields out', () => {
    expect(normalizeBrazilianFields({ phone: '', cnpj: undefined })).toEqual({});
  });

  it.each([
    [{ cnpj: '11.222.333/0001-80' }, 'CNPJ is invalid'],
    [{ cpf: '123.456.789-00' }, 'CPF is invalid'],
    [{ phone: '(11) 9123' }, 'Phone is invalid'],
    [{ phone: '0812345678' }, 'Phone is invalid'], // area code below 11
    [{ zip_code: '0131010' }, 'CEP is invalid'],
    [{ state: 'ZZ' }, 'State is invalid'],
  ])('rejects %j', (input, message) => {
    expect(() => normalizeBrazilianFields(input)).toThrow(message);
  });

  describe('alphanumeric CNPJ', () => {
    it('accepts the official example, formatted or not, in any case', () => {
      expect(isValidCnpj('12.ABC.345/01DE-35')).toBe(true);
      expect(isValidCnpj('12ABC34501DE35')).toBe(true);
      expect(isValidCnpj('12.abc.345/01de-35')).toBe(true);
    });

    it('keeps validating plain numeric CNPJs as before', () => {
      expect(isValidCnpj('11.222.333/0001-81')).toBe(true);
      expect(isValidCnpj('11.222.333/0001-80')).toBe(false);
      expect(isValidCnpj('11111111111111')).toBe(false);
    });

    it('rejects a wrong check digit, letters in the check digits and a wrong length', () => {
      expect(isValidCnpj('12.ABC.345/01DE-36')).toBe(false);
      expect(isValidCnpj('12.ABC.345/01DE-3X')).toBe(false);
      expect(isValidCnpj('12.ABC.345/01DE-3')).toBe(false);
      expect(isValidCnpj('12.ABD.345/01DE-35')).toBe(false); // one letter changed
    });

    it('stores it without punctuation and upper-cased, letters kept', () => {
      expect(cleanCnpj('12.abc.345/01de-35')).toBe('12ABC34501DE35');
      expect(normalizeBrazilianFields({ cnpj: '12.abc.345/01de-35' })).toEqual({ cnpj: '12ABC34501DE35' });
    });
  });
});
