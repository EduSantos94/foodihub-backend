/** Keeps only the digits ("12.345.678/0001-95" -> "12345678000195"). */
export const onlyDigits = (value: string): string => value.replace(/\D/g, '');

/**
 * Strips the punctuation of a CNPJ and upper-cases it. The CNPJ accepts letters in its first 12
 * characters (alphanumeric CNPJ): "12.abc.345/01de-35" -> "12ABC34501DE35".
 */
export const cleanCnpj = (value: string): string => value.replace(/[^0-9A-Za-z]/g, '').toUpperCase();

/**
 * Validates a CNPJ, numeric or alphanumeric: 12 characters (0-9, A-Z) followed by 2 numeric check
 * digits. Each character counts as its ASCII code minus 48 (so 0-9 keep their value, A is 17, Z is
 * 42), which makes every all-numeric CNPJ validate exactly as before. Accepts formatted input.
 */
export function isValidCnpj(value: string): boolean {
  const cnpj = cleanCnpj(value);
  if (!/^[0-9A-Z]{12}\d{2}$/.test(cnpj) || /^(.)\1{13}$/.test(cnpj)) return false;

  const check = (length: number): number => {
    const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((acc, w, i) => acc + (cnpj.charCodeAt(i) - 48) * w, 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  return check(12) === Number(cnpj[12]) && check(13) === Number(cnpj[13]);
}
