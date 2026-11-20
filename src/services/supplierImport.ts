import { isValidCnpj, cleanCnpj, onlyDigits } from '../utils/cnpj.js';
import { UFS } from '../utils/brazil.js';
import { cleanEmail, cleanName, importPhone, limitText, PreparedRow, text } from './importCommon.js';

/** One spreadsheet row after the columns were mapped to fields. Every value is text. */
export interface SupplierImportRow {
  row?: number;
  name?: string;
  cnpj?: string;
  phone?: string;
  email?: string;
  contact_person?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  notes?: string;
}

export interface PreparedSupplier {
  name: string;
  cnpj?: string;
  phone?: string;
  email?: string;
  contact_person?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  notes?: string;
}

/** A bad optional field is dropped with a warning; a missing name makes the row an error. */
export function prepareSupplierRow(raw: SupplierImportRow): PreparedRow<PreparedSupplier> {
  const warnings: string[] = [];
  const warn = (code: string) => {
    if (!warnings.includes(code)) warnings.push(code);
  };
  const cut = (value: string, max: number) => limitText(value, max, () => warn('truncated'));

  const name = cleanName(raw.name);
  if (!name) return { warnings, error: 'name_required' };

  const data: PreparedSupplier = { name: cut(name, 255) };

  const cnpj = text(raw.cnpj);
  if (cnpj) {
    if (isValidCnpj(cnpj)) data.cnpj = cleanCnpj(cnpj);
    else warn('cnpj_invalid');
  }

  const phone = text(raw.phone);
  if (phone) {
    const normalized = importPhone(phone);
    if (normalized) data.phone = normalized;
    else warn('phone_invalid');
  }

  const email = text(raw.email);
  if (email) {
    const clean = cleanEmail(email);
    if (clean) data.email = clean;
    else warn('email_invalid');
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

  const contact = cleanName(raw.contact_person);
  if (contact) data.contact_person = cut(contact, 255);
  const address = cleanName(raw.address);
  if (address) data.address = cut(address, 500);
  const city = cleanName(raw.city);
  if (city) data.city = cut(city, 100);
  const notes = text(raw.notes);
  if (notes) data.notes = notes;

  return { data, warnings };
}
