import { cleanName, limitText, matchSynonym, normalizeText, ParsedDate, parseDate, parseMoney, PreparedRow, round2, text } from './importCommon.js';

/**
 * Purchases history from a spreadsheet with one row per item bought. Rows of the same supplier, date and
 * situation become one purchase; the items are listed in the purchase's notes. Nothing here touches the
 * stock of supplies: it is history.
 */

export interface PurchaseHistoryRow {
  row?: number;
  date?: string;
  supplier?: string;
  /** What was bought: free text ("Manteiga 500g") */
  item?: string;
  quantity?: string;
  unit_cost?: string;
  total?: string;
  /** paid / to pay / cancelled */
  status?: string;
  payment_method?: string;
  number?: string;
  invoice?: string;
  notes?: string;
}

export type PurchaseStatus = 'pending' | 'partial' | 'paid' | 'cancelled';
export type PurchaseMethod = 'cash' | 'credit_card' | 'debit_card' | 'bank_transfer' | 'pix' | 'other';

export const NO_SUPPLIER = 'Fornecedor não informado';

const STATUS: Record<PurchaseStatus, string[]> = {
  paid: ['pago', 'paga', 'quitado', 'quitada', 'liquidado', 'liquidada', 'pago total'],
  pending: ['pendente', 'a pagar', 'em aberto', 'aberto', 'aberta', 'fiado', 'nao pago', 'nao paga'],
  partial: ['parcial', 'parcialmente pago', 'pago parcial'],
  cancelled: ['cancelado', 'cancelada', 'estornado', 'estornada'],
};

const METHOD: Record<PurchaseMethod, string[]> = {
  cash: ['dinheiro', 'especie', 'a vista'],
  credit_card: ['cartao de credito', 'credito', 'cartao'],
  debit_card: ['cartao de debito', 'debito'],
  bank_transfer: ['transferencia', 'ted', 'doc', 'boleto', 'deposito'],
  pix: ['pix'],
  other: ['outro', 'outros', 'outra'],
};

export interface PurchaseLine {
  /** YYYY-MM-DD */
  date: string;
  supplier: string;
  item?: string;
  quantity?: number;
  total: number;
  status: PurchaseStatus;
  method: PurchaseMethod;
  number?: string;
  invoice?: string;
  notes?: string;
}

export interface PurchaseContext {
  /** Date for rows that have none (the sheet may not date its purchases) */
  defaultDate?: ParsedDate;
  /** normalised supplier name -> id, of the suppliers already registered */
  suppliers: Map<string, string>;
  createMissingSuppliers: boolean;
}

export function preparePurchaseLine(raw: PurchaseHistoryRow, ctx: PurchaseContext): PreparedRow<PurchaseLine> {
  const warnings: string[] = [];
  const warn = (code: string) => {
    if (!warnings.includes(code)) warnings.push(code);
  };

  const dateText = text(raw.date);
  let date: ParsedDate | null;
  if (dateText) {
    date = parseDate(dateText);
    if (!date) return { warnings, error: 'date_invalid' };
  } else {
    date = ctx.defaultDate ?? null;
    if (!date) return { warnings, error: 'date_missing' };
  }

  const quantity = text(raw.quantity) ? parseMoney(raw.quantity) : null;
  const unitCost = text(raw.unit_cost) ? parseMoney(raw.unit_cost) : null;
  let total: number | null = null;
  if (text(raw.total)) {
    total = parseMoney(raw.total);
    if (total === null || total < 0) return { warnings, error: 'total_invalid' };
  } else if (quantity !== null && unitCost !== null && quantity >= 0 && unitCost >= 0) {
    total = round2(quantity * unitCost);
  }
  if (total === null) return { warnings, error: 'total_invalid' };

  let supplier = cleanName(raw.supplier);
  if (!supplier) {
    supplier = NO_SUPPLIER;
    warn('supplier_missing');
  }
  if (!ctx.createMissingSuppliers && !ctx.suppliers.has(normalizeText(supplier))) {
    return { warnings, error: 'supplier_not_found' };
  }

  let status: PurchaseStatus = 'paid';
  if (text(raw.status)) {
    const matched = matchSynonym(raw.status, STATUS);
    if (matched) status = matched;
    else warn('status_unknown');
  }

  let method: PurchaseMethod = 'other';
  if (text(raw.payment_method)) {
    const matched = matchSynonym(raw.payment_method, METHOD);
    if (matched) method = matched;
    else warn('payment_method_unknown');
  }

  const line: PurchaseLine = { date: date.date, supplier: limitText(supplier, 255, () => warn('truncated')), total: round2(total), status, method };
  const item = cleanName(raw.item);
  if (item) line.item = item;
  if (quantity !== null && quantity > 0) line.quantity = quantity;
  const number = cleanName(raw.number);
  if (number) line.number = limitText(number, 50, () => warn('truncated'));
  const invoice = cleanName(raw.invoice);
  if (invoice) line.invoice = limitText(invoice, 50, () => warn('truncated'));
  const notes = text(raw.notes);
  if (notes) line.notes = notes;
  return { data: line, warnings };
}

export interface PurchaseRecord {
  date: string;
  supplier: string;
  total: number;
  status: PurchaseStatus;
  method: PurchaseMethod;
  number?: string;
  invoice?: string;
  notes?: string;
}

const MAX_NOTES = 5000;
const qtyText = (n: number): string => String(Math.round(n * 1000) / 1000).replace('.', ',');

/** One purchase from the lines of a group: total = sum, notes = the items and the distinct remarks. */
export function buildPurchase(lines: PurchaseLine[]): PurchaseRecord {
  const first = lines[0];
  const items = lines.filter((l) => l.item).map((l) => (l.quantity !== undefined ? `${l.item} ×${qtyText(l.quantity)}` : (l.item as string)));
  const remarks = [...new Set(lines.map((l) => l.notes).filter((n): n is string => Boolean(n)))];
  const parts: string[] = [];
  if (items.length > 0) parts.push(`Itens: ${items.join('; ')}`);
  if (remarks.length > 0) parts.push(remarks.join(' | '));

  const record: PurchaseRecord = {
    date: first.date,
    supplier: first.supplier,
    total: round2(lines.reduce((sum, l) => sum + l.total, 0)),
    status: first.status,
    method: first.method,
  };
  if (first.number) record.number = first.number;
  if (first.invoice) record.invoice = first.invoice;
  if (parts.length > 0) record.notes = parts.join('\n').slice(0, MAX_NOTES);
  return record;
}

/** The key that makes two purchases "the same" (so importing a sheet again does not duplicate them). */
export function purchaseKeys(r: { date: string; supplier: string; total: number; status: string; number?: string | null }): string[] {
  const supplier = normalizeText(r.supplier);
  const keys = [`s|${r.date}|${supplier}|${r.total.toFixed(2)}|${r.status}`];
  if (r.number) keys.push(`n|${supplier}|${normalizeText(r.number)}`);
  return keys;
}
