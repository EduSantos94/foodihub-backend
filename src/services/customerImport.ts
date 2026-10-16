import { isValidCpf } from '../utils/brazil.js';
import { onlyDigits } from '../utils/cnpj.js';

/** One spreadsheet row after the columns were mapped to fields. Every value is text. */
export interface CustomerImportRow {
  /** Line number in the spreadsheet, so the report can point at it */
  row?: number;
  /** "Maria da Silva": split into first name (first word) and last name (the rest) */
  full_name?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  cpf?: string;
  delivery_address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  notes?: string;
}

export type ImportWarningCode =
  | 'phone_invalid'
  | 'email_invalid'
  | 'cpf_invalid'
  | 'zip_code_invalid'
  | 'state_invalid'
  | 'truncated';

export type ImportErrorCode = 'name_required';

export interface PreparedCustomer {
  first_name: string;
  last_name?: string;
  email?: string;
  phone?: string;
  cpf?: string;
  delivery_address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  notes?: string;
}

export interface PreparedRow {
  data?: PreparedCustomer;
  warnings: ImportWarningCode[];
  error?: ImportErrorCode;
}

const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Column sizes of the customers table
const LIMITS = { first_name: 100, last_name: 100, email: 255, delivery_address: 500, city: 100 } as const;

const text = (value: unknown): string => (value === undefined || value === null ? '' : String(value).trim());

/**
 * Phone as people write it in spreadsheets: with country code ("+55 11 91234-5678"), with a leading
 * zero ("011 ...") or plain digits. Returns null when it is not a valid Brazilian number.
 */
export function importPhone(value: string): string | null {
  let digits = onlyDigits(value);
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) digits = digits.slice(2);
  if ((digits.length === 11 || digits.length === 12) && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length !== 10 && digits.length !== 11) return null;
  return Number(digits.slice(0, 2)) >= 11 ? digits : null;
}

/**
 * Validates and normalises one row. A bad name makes the row an error; a bad optional field (phone,
 * e-mail, CPF, CEP, state) is dropped with a warning, so a messy spreadsheet still brings its
 * customers in instead of being rejected as a whole.
 */
export function prepareCustomerRow(raw: CustomerImportRow): PreparedRow {
  const warnings: ImportWarningCode[] = [];
  const warn = (code: ImportWarningCode) => {
    if (!warnings.includes(code)) warnings.push(code);
  };
  const limit = (value: string, max: number): string => {
    if (value.length <= max) return value;
    warn('truncated');
    return value.slice(0, max);
  };

  let first = text(raw.first_name);
  let last = text(raw.last_name);
  const full = text(raw.full_name).replace(/\s+/g, ' ');
  if (!first && full) {
    const [head, ...rest] = full.split(' ');
    first = head;
    if (!last) last = rest.join(' ');
  }
  if (!first) return { warnings, error: 'name_required' };

  const data: PreparedCustomer = { first_name: limit(first, LIMITS.first_name) };
  if (last) data.last_name = limit(last, LIMITS.last_name);

  const email = text(raw.email).toLowerCase();
  if (email) {
    if (EMAIL.test(email) && email.length <= LIMITS.email) data.email = email;
    else warn('email_invalid');
  }

  const phone = text(raw.phone);
  if (phone) {
    const normalized = importPhone(phone);
    if (normalized) data.phone = normalized;
    else warn('phone_invalid');
  }

  // Spreadsheets store CPF/CEP as numbers and drop the leading zeros: put them back
  const cpfDigits = onlyDigits(text(raw.cpf));
  if (cpfDigits) {
    const cpf = cpfDigits.length >= 9 && cpfDigits.length < 11 ? cpfDigits.padStart(11, '0') : cpfDigits;
    if (isValidCpf(cpf)) data.cpf = cpf;
    else warn('cpf_invalid');
  }

  const zipDigits = onlyDigits(text(raw.zip_code));
  if (zipDigits) {
    const zip = zipDigits.length === 7 ? zipDigits.padStart(8, '0') : zipDigits;
    if (zip.length === 8) data.zip_code = zip;
    else warn('zip_code_invalid');
  }

  const state = text(raw.state).toUpperCase();
  if (state) {
    if (UFS.includes(state)) data.state = state;
    else warn('state_invalid');
  }

  const address = text(raw.delivery_address);
  if (address) data.delivery_address = limit(address, LIMITS.delivery_address);
  const city = text(raw.city);
  if (city) data.city = limit(city, LIMITS.city);
  const notes = text(raw.notes);
  if (notes) data.notes = notes;

  return { data, warnings };
}
