import { cleanCnpj, isValidCnpj, onlyDigits } from './cnpj.js';

const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

export function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const check = (length: number): number => {
    const sum = Array.from({ length }, (_, i) => Number(cpf[i]) * (length + 1 - i)).reduce((a, b) => a + b, 0);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return check(9) === Number(cpf[9]) && check(10) === Number(cpf[10]);
}

/**
 * Validates the Brazilian-format fields of a record and returns them normalised (punctuation-free for
 * documents, phone and CEP; upper case for the state). Fields that are absent or empty are left
 * out, so the result can be spread over the data being saved. Throws on the first invalid value.
 */
export function normalizeBrazilianFields<T extends { cnpj?: string; cpf?: string; phone?: string; zip_code?: string; state?: string }>(
  data: T
): Partial<Pick<T, 'cnpj' | 'cpf' | 'phone' | 'zip_code' | 'state'>> {
  const out: Partial<Pick<T, 'cnpj' | 'cpf' | 'phone' | 'zip_code' | 'state'>> = {};

  if (data.cnpj) {
    if (!isValidCnpj(data.cnpj)) throw new Error('CNPJ is invalid');
    out.cnpj = cleanCnpj(data.cnpj) as T['cnpj'];
  }
  if (data.cpf) {
    if (!isValidCpf(data.cpf)) throw new Error('CPF is invalid');
    out.cpf = onlyDigits(data.cpf) as T['cpf'];
  }
  if (data.phone) {
    const phone = onlyDigits(data.phone);
    if ((phone.length !== 10 && phone.length !== 11) || Number(phone.slice(0, 2)) < 11) {
      throw new Error('Phone is invalid: use the area code and the number');
    }
    out.phone = phone as T['phone'];
  }
  if (data.zip_code) {
    const zip = onlyDigits(data.zip_code);
    if (zip.length !== 8) throw new Error('CEP is invalid: use 8 digits');
    out.zip_code = zip as T['zip_code'];
  }
  if (data.state) {
    const state = data.state.toUpperCase();
    if (!UFS.includes(state)) throw new Error('State is invalid');
    out.state = state as T['state'];
  }
  return out;
}
