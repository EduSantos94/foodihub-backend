import { cleanName, limitText, matchSynonym, normalizeText, ParsedDate, parseDate, parseMoney, PreparedRow, round2, text, toUtcTimestamp } from './importCommon.js';

/**
 * Sales history from a spreadsheet with one row per item sold. Rows of the same customer, day, payment
 * method and situation become one order with its items (the price of the day is kept). It never touches
 * the stock of products and never fires webhooks: it is history.
 */

export interface SaleHistoryRow {
  row?: number;
  date?: string;
  /** The sheet's own order number, when it has one: rows with the same number are one order */
  number?: string;
  customer?: string;
  product?: string;
  quantity?: string;
  unit_price?: string;
  subtotal?: string;
  discount?: string;
  total?: string;
  payment_method?: string;
  /** Payment situation: paid / to receive / cancelled */
  status?: string;
  notes?: string;
}

export type SaleMethod = 'cash' | 'credit_card' | 'debit_card' | 'pix' | 'bank_transfer';
export type SalePaymentStatus = 'pending' | 'paid' | 'cancelled';

const METHOD: Record<SaleMethod, string[]> = {
  cash: ['dinheiro', 'especie', 'a vista', 'cash'],
  credit_card: ['cartao de credito', 'credito', 'cartao'],
  debit_card: ['cartao de debito', 'debito'],
  pix: ['pix'],
  bank_transfer: ['transferencia', 'ted', 'doc', 'boleto', 'deposito'],
};

const STATUS: Record<SalePaymentStatus, string[]> = {
  paid: ['pago', 'paga', 'quitado', 'quitada', 'recebido', 'recebida', 'entregue', 'concluido', 'concluida', 'finalizado'],
  pending: ['pendente', 'a receber', 'em aberto', 'aberto', 'aberta', 'fiado', 'devendo', 'nao pago', 'nao paga'],
  cancelled: ['cancelado', 'cancelada', 'estornado', 'estornada'],
};

export interface CatalogProduct {
  id: string;
  name: string;
  price: number;
}

export interface SaleContext {
  defaultDate?: ParsedDate;
  /** normalised customer name -> id */
  customers: Map<string, string>;
  /** normalised product name -> product */
  products: Map<string, CatalogProduct>;
  createMissingProducts: boolean;
}

export interface SaleLine {
  date: ParsedDate;
  number?: string;
  customerKey: string;
  customerId?: string;
  /** Product name as written in the sheet (absent for lines that are only an amount) */
  productName?: string;
  productId?: string;
  quantity?: number;
  unitPrice?: number;
  subtotal: number;
  discount: number;
  total: number;
  method: SaleMethod;
  paymentStatus: SalePaymentStatus;
  notes?: string;
}

const intQuantity = (n: number, warn: (c: string) => void): number => {
  const rounded = Math.round(n);
  if (rounded !== n) warn('quantity_rounded');
  return rounded;
};

export function prepareSaleLine(raw: SaleHistoryRow, ctx: SaleContext): PreparedRow<SaleLine> {
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

  // ---- amounts
  const parse = (value: unknown): number | null | undefined => (text(value) ? parseMoney(value) : undefined);
  const subtotalGiven = parse(raw.subtotal);
  const totalGiven = parse(raw.total);
  const discountGiven = parse(raw.discount);
  const unitGiven = parse(raw.unit_price);
  const quantityGiven = parse(raw.quantity);
  if (subtotalGiven === null || totalGiven === null || unitGiven === null || (unitGiven ?? 0) < 0) return { warnings, error: 'total_invalid' };
  if (discountGiven === null || (discountGiven ?? 0) < 0) {
    warn('discount_invalid');
  }
  const discount = discountGiven && discountGiven > 0 ? round2(discountGiven) : 0;

  // ---- product and quantity
  const productName = cleanName(raw.product);
  let productId: string | undefined;
  let quantity: number | undefined;
  let unitPrice: number | undefined;

  if (productName) {
    const product = ctx.products.get(normalizeText(productName));
    if (product) productId = product.id;
    else if (!ctx.createMissingProducts) return { warnings, error: 'product_not_found' };
    else warn('product_created');

    if (quantityGiven === null || (quantityGiven !== undefined && quantityGiven <= 0)) return { warnings, error: 'quantity_invalid' };
    if (quantityGiven === undefined) {
      quantity = 1;
      warn('quantity_assumed');
    } else {
      quantity = Math.max(1, intQuantity(quantityGiven, warn));
    }

    if (unitGiven !== undefined) unitPrice = round2(unitGiven);
    else if (subtotalGiven !== undefined && subtotalGiven !== null) unitPrice = round2(subtotalGiven / quantity);
    else if (product) {
      unitPrice = product.price;
      warn('price_from_catalog');
    } else return { warnings, error: 'total_invalid' };
  }

  const subtotal = subtotalGiven ?? (unitPrice !== undefined && quantity !== undefined ? round2(unitPrice * quantity) : totalGiven !== undefined ? round2((totalGiven ?? 0) + discount) : undefined);
  if (subtotal === undefined || subtotal < 0) return { warnings, error: 'total_invalid' };
  const total = totalGiven ?? round2(subtotal - discount);
  if (total < 0) return { warnings, error: 'total_invalid' };

  // ---- customer
  const customerName = cleanName(raw.customer);
  const customerKey = normalizeText(customerName);
  let customerId: string | undefined;
  if (customerName) {
    customerId = ctx.customers.get(customerKey);
    if (!customerId) warn('customer_not_found');
  }

  // ---- payment
  let method: SaleMethod = 'cash';
  if (text(raw.payment_method)) {
    const matched = matchSynonym(raw.payment_method, METHOD);
    if (matched) method = matched;
    else warn('payment_method_unknown');
  } else {
    warn('payment_method_missing');
  }

  let paymentStatus: SalePaymentStatus = 'paid';
  if (text(raw.status)) {
    const matched = matchSynonym(raw.status, STATUS);
    if (matched) paymentStatus = matched;
    else warn('status_unknown');
  }

  const line: SaleLine = { date, customerKey, subtotal: round2(subtotal), discount, total: round2(total), method, paymentStatus };
  if (customerId) line.customerId = customerId;
  if (productName) {
    line.productName = limitText(productName, 255, () => warn('truncated'));
    if (productId) line.productId = productId;
    line.quantity = quantity;
    line.unitPrice = unitPrice;
  }
  const number = cleanName(raw.number);
  if (number) line.number = limitText(number, 50, () => warn('truncated'));
  const notes = text(raw.notes);
  if (notes) line.notes = notes;
  return { data: line, warnings };
}

export interface SaleItemRecord {
  productName: string;
  productId?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface SaleRecord {
  /** UTC timestamp, YYYY-MM-DD HH:MM:SS */
  at: string;
  number?: string;
  customerId?: string;
  customerKey: string;
  subtotal: number;
  discount: number;
  total: number;
  method: SaleMethod;
  paymentStatus: SalePaymentStatus;
  notes?: string;
  items: SaleItemRecord[];
}

const MAX_NOTES = 5000;

export function buildSale(lines: SaleLine[]): SaleRecord {
  const first = lines[0];
  const remarks = [...new Set(lines.map((l) => l.notes).filter((n): n is string => Boolean(n)))];
  const items: SaleItemRecord[] = lines
    .filter((l) => l.productName && l.quantity !== undefined && l.unitPrice !== undefined)
    .map((l) => ({
      productName: l.productName as string,
      productId: l.productId,
      quantity: l.quantity as number,
      unitPrice: l.unitPrice as number,
      totalPrice: round2((l.quantity as number) * (l.unitPrice as number)),
    }));

  const record: SaleRecord = {
    at: toUtcTimestamp(first.date),
    customerKey: first.customerKey,
    subtotal: round2(lines.reduce((s, l) => s + l.subtotal, 0)),
    discount: round2(lines.reduce((s, l) => s + l.discount, 0)),
    total: round2(lines.reduce((s, l) => s + l.total, 0)),
    method: first.method,
    paymentStatus: first.paymentStatus,
    items,
  };
  const withCustomer = lines.find((l) => l.customerId);
  if (withCustomer?.customerId) record.customerId = withCustomer.customerId;
  if (first.number) record.number = first.number;
  if (remarks.length > 0) record.notes = remarks.join(' | ').slice(0, MAX_NOTES);
  return record;
}

/** What makes two orders "the same", so importing a sheet again does not duplicate them. */
export function saleKeys(r: { at: string; customer: string; method: string; paymentStatus: string; total: number; number?: string | null }): string[] {
  const keys = [`s|${r.at}|${r.customer}|${r.method}|${r.paymentStatus}|${r.total.toFixed(2)}`];
  if (r.number) keys.push(`n|${normalizeText(r.number)}`);
  return keys;
}
