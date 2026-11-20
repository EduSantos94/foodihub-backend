import { cleanName, limitText, normalizeText, parseBoolean, parseMoney, PreparedRow, text } from './importCommon.js';

export interface ProductImportRow {
  row?: number;
  name?: string;
  description?: string;
  price?: string;
  /** Opening stock */
  amount?: string;
  /** Category name; matched against the platform's categories */
  category?: string;
  active?: string;
}

export interface PreparedProduct {
  name: string;
  description?: string;
  price: number;
  amount: number;
  category_id?: string;
  active: boolean;
}

/**
 * `categories` maps a normalised category name to its id (only active categories, which are global).
 * `defaultAmount` is the stock for rows that do not say one: a product with stock 0 cannot be sold, and a
 * store that makes things to order has no stock column.
 * A missing name is an error; a bad price, stock or category is dropped with a warning.
 */
export function prepareProductRow(raw: ProductImportRow, categories: Map<string, string>, defaultAmount = 0): PreparedRow<PreparedProduct> {
  const warnings: string[] = [];
  const warn = (code: string) => {
    if (!warnings.includes(code)) warnings.push(code);
  };

  const name = cleanName(raw.name);
  if (!name) return { warnings, error: 'name_required' };

  let price = 0;
  const priceText = text(raw.price);
  if (priceText) {
    const n = parseMoney(priceText);
    if (n === null || n < 0 || n > 99999999.99) warn('price_invalid');
    else price = Math.round(n * 100) / 100;
  }

  let amount = defaultAmount;
  const amountText = text(raw.amount);
  if (amountText) {
    const n = parseMoney(amountText);
    if (n === null || n < 0 || n > 2147483647) {
      warn('amount_invalid');
      amount = 0;
    }
    else {
      amount = Math.round(n);
      if (amount !== n) warn('amount_rounded');
    }
  }

  const data: PreparedProduct = { name: limitText(name, 255, () => warn('truncated')), price, amount, active: true };

  const categoryText = text(raw.category);
  if (categoryText) {
    const id = categories.get(normalizeText(categoryText));
    if (id) data.category_id = id;
    else warn('category_unknown');
  }

  const active = parseBoolean(raw.active);
  if (text(raw.active) && active === null) warn('active_unknown');
  if (active !== null) data.active = active;

  const description = text(raw.description);
  if (description) data.description = description;

  return { data, warnings };
}
