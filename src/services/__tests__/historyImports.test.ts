import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runGroupedImport, toUtcTimestamp, parseDate } from '../importCommon.js';
import { buildPurchase, preparePurchaseLine, purchaseKeys, NO_SUPPLIER } from '../purchaseHistoryImport.js';
import { buildSale, prepareSaleLine, saleKeys } from '../saleHistoryImport.js';
import { PurchaseService } from '../PurchaseService.js';
import { SaleService } from '../SaleService.js';
import { PurchaseModel } from '../../database/models/PurchaseModel.js';
import { SupplierModel } from '../../database/models/SupplierModel.js';
import { SaleModel } from '../../database/models/SaleModel.js';
import { SaleItemModel } from '../../database/models/SaleItemModel.js';
import { ProductModel } from '../../database/models/ProductModel.js';
import { CustomerModel } from '../../database/models/CustomerModel.js';
import { createDataSource } from '../../database/connection.js';

vi.mock('../../database/connection.js', () => ({ createDataSource: vi.fn() }));

describe('toUtcTimestamp', () => {
  it('turns Brazilian time into the UTC the database keeps', () => {
    expect(toUtcTimestamp({ date: '2025-11-01', time: '19:30:00' })).toBe('2025-11-01 22:30:00');
    expect(toUtcTimestamp({ date: '2025-11-01', time: '22:30:00' })).toBe('2025-11-02 01:30:00'); // crosses midnight
  });
  it('uses noon in Brazil when there is no time, so the day never shifts', () => {
    expect(toUtcTimestamp({ date: '2025-11-01' })).toBe('2025-11-01 15:00:00');
    expect(toUtcTimestamp({ date: '2025-12-31' })).toBe('2025-12-31 15:00:00');
  });
});

describe('runGroupedImport', () => {
  const spec = (known = new Set<string>()) => ({
    prepare: (raw: any) => (raw.k ? { data: { k: String(raw.k), v: Number(raw.v ?? 0) }, warnings: raw.w ? ['w'] : [] } : { warnings: [], error: 'k_required' }),
    groupKey: (l: { k: string }) => l.k,
    build: (lines: { k: string; v: number }[]) => ({ k: lines[0].k, total: lines.reduce((s, l) => s + l.v, 0) }),
    check: (r: { k: string }) => (known.has(r.k) ? 'same' : (known.add(r.k), undefined)),
    insert: vi.fn(async () => undefined),
  });

  it('groups rows into records and counts rows and records', async () => {
    const s = spec();
    const result = await runGroupedImport([{ row: 2, k: 'a', v: 1 }, { row: 3, k: 'b', v: 5 }, { row: 4, k: 'a', v: 2, w: 1 }, { row: 5 }], false, s);
    expect(result).toMatchObject({ total: 4, created: 3, records: 2, errors: 1, duplicates: 0, with_warnings: 1 });
    expect(s.insert).toHaveBeenCalledWith([{ k: 'a', total: 3 }, { k: 'b', total: 5 }]);
    expect(result.problems.map((p) => [p.row, p.status])).toEqual([[4, 'warning'], [5, 'error']]);
  });

  it('marks every row of a repeated record as duplicate', async () => {
    const s = spec(new Set(['a']));
    const result = await runGroupedImport([{ row: 2, k: 'a' }, { row: 3, k: 'a' }, { row: 4, k: 'b' }], false, s);
    expect(result).toMatchObject({ created: 1, records: 1, duplicates: 2 });
    expect(result.problems.map((p) => [p.row, p.reason])).toEqual([[2, 'same'], [3, 'same']]);
  });

  it('writes nothing on a dry run', async () => {
    const s = spec();
    expect((await runGroupedImport([{ k: 'a' }], true, s)).records).toBe(1);
    expect(s.insert).not.toHaveBeenCalled();
  });
});

describe('purchases history', () => {
  const ctx = (extra = {}) => ({ suppliers: new Map<string, string>(), createMissingSuppliers: true, ...extra });

  it('reads a line like the confectionery sheet: item, quantity, cost, total and "Pago"', () => {
    const { data, warnings } = preparePurchaseLine(
      { date: '5/11/25', supplier: 'Copacol', item: 'Manteiga Frimesa 500g', quantity: '2', unit_cost: '$ 19.90', total: '$ 39.80', status: 'Pago' },
      ctx()
    );
    expect(warnings).toEqual([]);
    expect(data).toMatchObject({ date: '2025-11-05', supplier: 'Copacol', item: 'Manteiga Frimesa 500g', quantity: 2, total: 39.8, status: 'paid', method: 'other' });
  });

  it('uses the default date when the sheet has none, and errors without it', () => {
    const base = { supplier: 'Copacol', total: '10' };
    expect(preparePurchaseLine(base, ctx()).error).toBe('date_missing');
    expect(preparePurchaseLine(base, ctx({ defaultDate: parseDate('01/10/2026') })).data?.date).toBe('2026-10-01');
    expect(preparePurchaseLine({ ...base, date: '32/13/2026' }, ctx({ defaultDate: parseDate('01/10/2026') })).error).toBe('date_invalid');
  });

  it('computes the total from quantity and cost when the sheet has no total', () => {
    expect(preparePurchaseLine({ date: '1/1/26', supplier: 'X', quantity: '0,556', unit_cost: '69,90' }, ctx()).data?.total).toBe(38.86);
    expect(preparePurchaseLine({ date: '1/1/26', supplier: 'X' }, ctx()).error).toBe('total_invalid');
    expect(preparePurchaseLine({ date: '1/1/26', supplier: 'X', total: 'abc' }, ctx()).error).toBe('total_invalid');
  });

  it('maps the situation and falls back to paid with a warning when unknown', () => {
    const line = (status: string) => preparePurchaseLine({ date: '1/1/26', supplier: 'X', total: '1', status }, ctx());
    expect(line('Cancelado').data?.status).toBe('cancelled');
    expect(line('A pagar').data?.status).toBe('pending');
    expect(line('Pago').data?.status).toBe('paid');
    const odd = line('quem sabe');
    expect(odd.data?.status).toBe('paid');
    expect(odd.warnings).toEqual(['status_unknown']);
  });

  it('uses a placeholder supplier when the name is empty, and refuses unknown suppliers when not allowed to create them', () => {
    const blank = preparePurchaseLine({ date: '1/1/26', total: '1' }, ctx());
    expect(blank.data?.supplier).toBe(NO_SUPPLIER);
    expect(blank.warnings).toEqual(['supplier_missing']);
    expect(preparePurchaseLine({ date: '1/1/26', supplier: 'Novo', total: '1' }, ctx({ createMissingSuppliers: false })).error).toBe('supplier_not_found');
    const known = new Map([['copacol', 'id-1']]);
    expect(preparePurchaseLine({ date: '1/1/26', supplier: 'COPACOL', total: '1' }, ctx({ createMissingSuppliers: false, suppliers: known })).data).toBeTruthy();
  });

  it('builds one purchase per group: summed total and the items in the notes', () => {
    const a = preparePurchaseLine({ date: '5/11/25', supplier: 'GoioPlast', item: 'Coco flocos', quantity: '0,556', total: '38,86', status: 'Pago', notes: 'urgente' }, ctx()).data!;
    const b = preparePurchaseLine({ date: '5/11/25', supplier: 'Goioplast', item: 'Luva latex', quantity: '2', total: '4,86', status: 'Pago' }, ctx()).data!;
    const record = buildPurchase([a, b]);
    expect(record).toMatchObject({ date: '2025-11-05', total: 43.72, status: 'paid' });
    expect(record.notes).toBe('Itens: Coco flocos ×0,556; Luva latex ×2\nurgente');
  });

  it('keys: same number, or same supplier/date/total/situation, with the supplier compared without case', () => {
    expect(purchaseKeys({ date: '2025-11-05', supplier: 'GoioPlast', total: 43.72, status: 'paid' })).toEqual(purchaseKeys({ date: '2025-11-05', supplier: 'goioplast', total: 43.72, status: 'paid' }));
    expect(purchaseKeys({ date: '2025-11-05', supplier: 'X', total: 1, status: 'paid', number: 'NF-9' })).toHaveLength(2);
  });
});

describe('sales history', () => {
  const products = new Map([
    ['cookie red velvet', { id: 'p-rv', name: 'Cookie red velvet', price: 15 }],
    ['cookie cocada', { id: 'p-co', name: 'Cookie cocada', price: 12 }],
  ]);
  const customers = new Map([['ivonete', 'c-iv'], ['outros', 'c-out']]);
  const ctx = (extra = {}) => ({ customers, products, createMissingProducts: true, ...extra });

  it('reads a line like the confectionery sheet', () => {
    const { data, warnings } = prepareSaleLine(
      { date: '1/11/25', customer: 'Ivonete', product: 'Cookie cocada', quantity: '1', unit_price: '$ 12.00', subtotal: '$ 12.00', discount: '$ 2.00', total: '$ 10.00', payment_method: 'Pix', status: 'Pago', notes: 'Desconto por ter pedido mais' },
      ctx()
    );
    expect(warnings).toEqual([]);
    expect(data).toMatchObject({ customerId: 'c-iv', productId: 'p-co', quantity: 1, unitPrice: 12, subtotal: 12, discount: 2, total: 10, method: 'pix', paymentStatus: 'paid' });
    expect(data?.date).toEqual({ date: '2025-11-01' });
  });

  it('accepts the "Correção" line: no product, only an amount', () => {
    const { data, warnings } = prepareSaleLine({ date: '6/11/25', customer: 'Outros', subtotal: '$ 145.70', total: '$ 145.70', status: 'Pago', notes: 'Correção' }, ctx());
    expect(data?.productName).toBeUndefined();
    expect(data).toMatchObject({ customerId: 'c-out', subtotal: 145.7, total: 145.7, method: 'cash', paymentStatus: 'paid' });
    expect(warnings).toEqual(['payment_method_missing']);
  });

  it('warns about unknown customers (they become counter sales) and unknown products (created inactive)', () => {
    const { data, warnings } = prepareSaleLine({ date: '1/11/25', customer: 'Desconhecida', product: 'Torta nova', quantity: '2', unit_price: '20', total: '40', payment_method: 'Pix' }, ctx());
    expect(data?.customerId).toBeUndefined();
    expect(data?.productId).toBeUndefined();
    expect(data?.productName).toBe('Torta nova');
    expect(warnings.sort()).toEqual(['customer_not_found', 'product_created']);
    expect(prepareSaleLine({ date: '1/11/25', product: 'Torta nova', quantity: '1', unit_price: '1', total: '1' }, ctx({ createMissingProducts: false })).error).toBe('product_not_found');
  });

  it('fills what is missing: quantity 1, price from the subtotal or the catalog, total from subtotal and discount', () => {
    const a = prepareSaleLine({ date: '1/11/25', product: 'Cookie cocada', payment_method: 'Pix' }, ctx());
    expect(a.data).toMatchObject({ quantity: 1, unitPrice: 12, subtotal: 12, total: 12 });
    expect(a.warnings.sort()).toEqual(['price_from_catalog', 'quantity_assumed']);
    expect(prepareSaleLine({ date: '1/11/25', product: 'Cookie cocada', quantity: '3', subtotal: '33', payment_method: 'Pix' }, ctx()).data).toMatchObject({ unitPrice: 11, subtotal: 33, total: 33 });
    expect(prepareSaleLine({ date: '1/11/25', product: 'Cookie cocada', quantity: '2', unit_price: '12', discount: '4', payment_method: 'Pix' }, ctx()).data).toMatchObject({ subtotal: 24, discount: 4, total: 20 });
  });

  it('rejects an impossible quantity, a missing date and a line without any amount', () => {
    expect(prepareSaleLine({ date: '1/11/25', product: 'Cookie cocada', quantity: '0' }, ctx()).error).toBe('quantity_invalid');
    expect(prepareSaleLine({ date: '1/11/25', product: 'Cookie cocada', quantity: 'x' }, ctx()).error).toBe('quantity_invalid');
    expect(prepareSaleLine({ product: 'Cookie cocada', quantity: '1' }, ctx()).error).toBe('date_missing');
    expect(prepareSaleLine({ date: '1/11/25', customer: 'Ivonete' }, ctx()).error).toBe('total_invalid');
  });

  it('maps the payment situation: pending ("A receber") and cancelled', () => {
    const line = (status: string) => prepareSaleLine({ date: '1/11/25', total: '10', payment_method: 'Pix', status }, ctx()).data;
    expect(line('A receber')?.paymentStatus).toBe('pending');
    expect(line('Cancelado')?.paymentStatus).toBe('cancelled');
    expect(line('Pago')?.paymentStatus).toBe('paid');
  });

  it('builds one order from the lines of the same customer and day, with its items and the day prices', () => {
    const lines = [
      prepareSaleLine({ date: '1/11/25', customer: 'Ivonete', product: 'Cookie red velvet', quantity: '1', unit_price: '15', total: '15', payment_method: 'Pix', status: 'Pago' }, ctx()).data!,
      prepareSaleLine({ date: '1/11/25', customer: 'Ivonete', product: 'Cookie cocada', quantity: '2', unit_price: '12', discount: '2', total: '22', payment_method: 'Pix', status: 'Pago', notes: 'Fidelidade' }, ctx()).data!,
    ];
    const sale = buildSale(lines);
    expect(sale).toMatchObject({ at: '2025-11-01 15:00:00', customerId: 'c-iv', subtotal: 39, discount: 2, total: 37, method: 'pix', paymentStatus: 'paid', notes: 'Fidelidade' });
    expect(sale.items).toEqual([
      { productName: 'Cookie red velvet', productId: 'p-rv', quantity: 1, unitPrice: 15, totalPrice: 15 },
      { productName: 'Cookie cocada', productId: 'p-co', quantity: 2, unitPrice: 12, totalPrice: 24 },
    ]);
  });

  it('keys use the sheet number when there is one', () => {
    expect(saleKeys({ at: '2025-11-01 15:00:00', customer: 'c', method: 'pix', paymentStatus: 'paid', total: 37 })).toHaveLength(1);
    expect(saleKeys({ at: '2025-11-01 15:00:00', customer: 'c', method: 'pix', paymentStatus: 'paid', total: 37, number: 'P-1' })).toHaveLength(2);
  });
});

// ---- services with a fake data source ----
describe('history import services', () => {
  const inserted: { target: unknown; values: any[] }[] = [];
  const deleted: { target: unknown; where: string }[] = [];
  let existing: Map<unknown, any[]>;

  beforeEach(() => {
    inserted.length = 0;
    deleted.length = 0;
    existing = new Map();
    const manager = {
      createQueryBuilder: () => {
        let target: unknown;
        let where = '';
        const qb: any = {
          insert: () => qb,
          into: (t: unknown) => ((target = t), qb),
          values: (v: any[]) => (inserted.push({ target, values: v }), qb),
          delete: () => qb,
          from: (t: unknown) => ((target = t), qb),
          where: (w: string) => ((where = w), qb),
          execute: async () => {
            if (where) deleted.push({ target, where });
            return { affected: where ? 2 : undefined };
          },
        };
        return qb;
      },
    };
    (createDataSource as any).mockResolvedValue({
      getRepository: (model: unknown) => ({ find: vi.fn(async () => existing.get(model) ?? []) }),
      transaction: async (cb: any) => cb(manager),
    });
  });

  it('purchases: groups lines, creates the missing supplier, stores no items, and returns a batch id', async () => {
    existing.set(SupplierModel, [{ id: 'sup-1', name: 'Copacol' }]);
    const result = await new PurchaseService().importPurchaseHistory(
      'store-1',
      [
        { row: 2, date: '5/11/25', supplier: 'Copacol', item: 'Manteiga', quantity: '2', total: '39,80', status: 'Pago' },
        { row: 3, date: '5/11/25', supplier: 'copacol', item: 'Leite', quantity: '1', total: '5', status: 'Pago' },
        { row: 4, date: '5/11/25', supplier: 'Shopee', item: 'Creme', total: '55,49', status: 'Pago' },
        { row: 5, date: '5/11/25', supplier: 'Shopee', item: 'Saco', total: '39,99', status: 'Cancelado' },
      ]
    );
    expect(result).toMatchObject({ created: 4, records: 3, duplicates: 0, errors: 0 });
    expect(result.batch_id).toMatch(/^[0-9a-f-]{36}$/);

    const suppliers = inserted.find((i) => i.target === SupplierModel)!;
    expect(suppliers.values).toHaveLength(1);
    expect(suppliers.values[0]).toMatchObject({ name: 'Shopee', store_id: 'store-1', import_batch_id: result.batch_id });

    const purchases = inserted.find((i) => i.target === PurchaseModel)!.values;
    expect(purchases).toHaveLength(3);
    expect(purchases[0]).toMatchObject({ supplier_id: 'sup-1', purchase_date: '2025-11-05', total_amount: 44.8, paid_amount: 44.8, payment_status: 'paid', import_batch_id: result.batch_id });
    expect(purchases[0].notes).toBe('Itens: Manteiga ×2; Leite ×1');
    expect(purchases[2]).toMatchObject({ payment_status: 'cancelled', paid_amount: 0 });
  });

  it('purchases: a second import of the same sheet adds nothing', async () => {
    existing.set(SupplierModel, [{ id: 'sup-1', name: 'Copacol' }]);
    existing.set(PurchaseModel, [{ supplier_id: 'sup-1', purchase_date: '2025-11-05', total_amount: '39.80', payment_status: 'paid', purchase_number: null }]);
    const result = await new PurchaseService().importPurchaseHistory('store-1', [{ row: 2, date: '5/11/25', supplier: 'Copacol', total: '39,80', status: 'Pago' }]);
    expect(result).toMatchObject({ created: 0, duplicates: 1, records: 0 });
    expect(result.batch_id).toBeUndefined();
    expect(inserted).toHaveLength(0);
  });

  it('purchases: validates the default date and does not write on a dry run', async () => {
    await expect(new PurchaseService().importPurchaseHistory('store-1', [{ supplier: 'X', total: '1' }], { default_date: '99/99/9999' })).rejects.toThrow('default_date');
    const result = await new PurchaseService().importPurchaseHistory('store-1', [{ supplier: 'X', total: '1' }], { dry_run: true, default_date: '01/10/2026' });
    expect(result).toMatchObject({ dry_run: true, created: 1 });
    expect(result.batch_id).toBeUndefined();
    expect(inserted).toHaveLength(0);
  });

  it('sales: groups lines into orders with items, creates missing products inactive, never touches stock', async () => {
    existing.set(CustomerModel, [{ id: 'c-iv', first_name: 'Ivonete', last_name: null }]);
    existing.set(ProductModel, [{ id: 'p-rv', name: 'Cookie red velvet', price: '15.00' }]);
    const result = await new SaleService().importSaleHistory('store-1', [
      { row: 2, date: '1/11/25', customer: 'Ivonete', product: 'Cookie red velvet', quantity: '1', unit_price: '15', total: '15', payment_method: 'Pix', status: 'Pago' },
      { row: 3, date: '1/11/25', customer: 'Ivonete', product: 'Torta de limão', quantity: '1', unit_price: '30', total: '30', payment_method: 'Pix', status: 'Pago' },
      { row: 4, date: '4/11/25', customer: 'Magali', product: 'Cookie red velvet', quantity: '1', unit_price: '15', total: '15', payment_method: 'Dinheiro', status: 'Pago' },
    ]);
    expect(result).toMatchObject({ created: 3, records: 2, errors: 0 });
    expect(result.batch_id).toBeTruthy();

    const newProducts = inserted.find((i) => i.target === ProductModel)!.values;
    expect(newProducts).toEqual([expect.objectContaining({ name: 'Torta de limão', price: 30, amount: 0, active: false, store_id: 'store-1', import_batch_id: result.batch_id })]);

    const sales = inserted.find((i) => i.target === SaleModel)!.values;
    expect(sales).toHaveLength(2);
    expect(sales[0]).toMatchObject({ customer_id: 'c-iv', sale_date: '2025-11-01 15:00:00', created_at: '2025-11-01 15:00:00', total_amount: 45, subtotal: 45, status: 'delivered', payment_status: 'paid', paid_at: '2025-11-01 15:00:00', payment_method: 'pix', import_batch_id: result.batch_id });
    expect(sales[1]).toMatchObject({ customer_id: undefined, total_amount: 15, payment_method: 'cash' });

    const items = inserted.find((i) => i.target === SaleItemModel)!.values;
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({ product_id: 'p-rv', product_name: 'Cookie red velvet', quantity: 1, unit_price: 15, total_price: 15 });
    expect(items[1].product_id).toBe(newProducts[0].id);
    // no product stock is updated: nothing but inserts happened
    expect(deleted).toHaveLength(0);
  });

  it('sales: a "Correção" line becomes an order without items', async () => {
    existing.set(CustomerModel, [{ id: 'c-out', first_name: 'Outros', last_name: null }]);
    const result = await new SaleService().importSaleHistory('store-1', [{ row: 2, date: '6/11/25', customer: 'Outros', subtotal: '$ 145.70', total: '$ 145.70', status: 'Pago', notes: 'Correção' }]);
    expect(result).toMatchObject({ created: 1, records: 1 });
    expect(inserted.find((i) => i.target === SaleItemModel)).toBeUndefined();
    expect(inserted.find((i) => i.target === SaleModel)!.values[0]).toMatchObject({ total_amount: 145.7, notes: 'Correção' });
  });

  it('sales: skips an order that already exists and numbers rows from the sheet', async () => {
    existing.set(SaleModel, [{ sale_number: null, sale_date: new Date('2025-11-01T15:00:00Z'), customer_id: null, payment_method: 'pix', payment_status: 'paid', total_amount: '15.00' }]);
    const result = await new SaleService().importSaleHistory('store-1', [{ row: 7, date: '1/11/25', total: '15', payment_method: 'Pix', status: 'Pago' }]);
    expect(result).toMatchObject({ created: 0, duplicates: 1 });
    expect(result.problems[0]).toMatchObject({ row: 7, status: 'duplicate', reason: 'same' });
  });

  it('undo: deletes by batch and refuses a bad id or an unknown batch', async () => {
    const batch = '123e4567-e89b-42d3-a456-426614174000';
    expect(await new SaleService().undoSaleHistory('store-1', batch)).toEqual({ deleted_sales: 2, deleted_products: 2 });
    expect(await new PurchaseService().undoPurchaseHistory('store-1', batch)).toEqual({ deleted_purchases: 2, deleted_suppliers: 2 });
    expect(deleted.map((d) => d.where.includes('NOT EXISTS'))).toEqual([false, true, false, true]);
    await expect(new SaleService().undoSaleHistory('store-1', 'x; drop table sales')).rejects.toThrow('Invalid batch id');
    await expect(new PurchaseService().undoPurchaseHistory('store-1', '../etc')).rejects.toThrow('Invalid batch id');
  });
});
