import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { RUN, createTestStore, TestStore } from './helpers.js';
import { SaleService } from '../services/SaleService.js';
import { PurchaseService } from '../services/PurchaseService.js';

describe.skipIf(!RUN)('stock (real database)', () => {
  let t: TestStore;
  let productId: string;
  const sales = new SaleService();
  const purchases = new PurchaseService();

  const productAmount = async () =>
    (await t.ds.query('SELECT amount FROM products WHERE id = $1', [productId]))[0].amount as number;

  beforeAll(async () => {
    t = await createTestStore('stock');
    const [p] = await t.ds.query(
      "INSERT INTO products(store_id, name, price, amount) VALUES ($1, 'Cookie', 4.50, 5) RETURNING id",
      [t.storeId]
    );
    productId = p.id;
  });

  afterAll(async () => {
    await t?.cleanup();
  });

  it('sells, decrements products.amount and snapshots the price', async () => {
    const sale = await sales.createSale(t.storeId, undefined, { discount: 1, items: [{ product_id: productId, quantity: 2 }] });
    expect(sale.total_amount).toBe(8);
    expect(sale.items?.[0]).toMatchObject({ product_name: 'Cookie', unit_price: 4.5, quantity: 2 });
    expect(await productAmount()).toBe(3);
  });

  it('refuses to oversell and rolls back completely', async () => {
    const before = (await t.ds.query('SELECT count(*)::int c FROM sales WHERE store_id = $1', [t.storeId]))[0].c;
    await expect(
      sales.createSale(t.storeId, undefined, { items: [{ product_id: productId, quantity: 99 }] })
    ).rejects.toThrow('Insufficient stock');
    const after = (await t.ds.query('SELECT count(*)::int c FROM sales WHERE store_id = $1', [t.storeId]))[0].c;
    expect(after).toBe(before);
    expect(await productAmount()).toBe(3);
  });

  it('does not let a second item oversell undo the first (all-or-nothing)', async () => {
    const [p2] = await t.ds.query(
      "INSERT INTO products(store_id, name, price, amount) VALUES ($1, 'Pao', 2, 1) RETURNING id",
      [t.storeId]
    );
    await expect(
      sales.createSale(t.storeId, undefined, {
        items: [
          { product_id: productId, quantity: 1 },
          { product_id: p2.id, quantity: 5 },
        ],
      })
    ).rejects.toThrow('Insufficient stock');
    expect(await productAmount()).toBe(3);
  });

  it('cancelling gives the stock back, once', async () => {
    const sale = await sales.createSale(t.storeId, undefined, { items: [{ product_id: productId, quantity: 3 }] });
    expect(await productAmount()).toBe(0);

    const cancelled = await sales.cancelSale(sale.id, t.storeId);
    expect(cancelled.status).toBe('cancelled');
    expect(await productAmount()).toBe(3);

    await expect(sales.cancelSale(sale.id, t.storeId)).rejects.toThrow('already cancelled');
    expect(await productAmount()).toBe(3);
  });

  it('cannot sell a product of another store', async () => {
    const other = await createTestStore('other');
    try {
      const [fp] = await other.ds.query(
        "INSERT INTO products(store_id, name, price, amount) VALUES ($1, 'Foreign', 1, 10) RETURNING id",
        [other.storeId]
      );
      await expect(
        sales.createSale(t.storeId, undefined, { items: [{ product_id: fp.id, quantity: 1 }] })
      ).rejects.toThrow('Product not found');
    } finally {
      // other.cleanup() closes the shared connection, so only delete its rows here
      await t.ds.query('DELETE FROM stores WHERE id = $1', [other.storeId]);
    }
  });

  describe('purchases -> supplies.amount', () => {
    let supplyId: string;
    let supplierId: string;
    const supplyAmount = async () =>
      Number((await t.ds.query('SELECT amount FROM supplies WHERE id = $1', [supplyId]))[0].amount);

    beforeAll(async () => {
      supplyId = (await t.ds.query("INSERT INTO supplies(store_id, name, unit_measure) VALUES ($1, 'Farinha', 'kg') RETURNING id", [t.storeId]))[0].id;
      supplierId = (await t.ds.query("INSERT INTO suppliers(store_id, name) VALUES ($1, 'Fornecedor') RETURNING id", [t.storeId]))[0].id;
    });

    it('adds on create and removes on delete', async () => {
      const p = await purchases.createPurchase(t.storeId, {
        supplier_id: supplierId,
        purchase_date: '2026-10-13',
        items: [{ supply_id: supplyId, quantity: 10.5, unit_price: 3 }],
      });
      expect(await supplyAmount()).toBe(10.5);

      await purchases.deletePurchase(p.id, t.storeId);
      expect(await supplyAmount()).toBe(0);
    });

    it('rejects supplies and suppliers of another store without saving anything', async () => {
      const other = await createTestStore('other2');
      try {
        const foreignSupply = (await other.ds.query("INSERT INTO supplies(store_id, name, unit_measure) VALUES ($1, 'X', 'kg') RETURNING id", [other.storeId]))[0].id;
        const before = (await t.ds.query('SELECT count(*)::int c FROM purchases WHERE store_id = $1', [t.storeId]))[0].c;

        await expect(
          purchases.createPurchase(t.storeId, {
            supplier_id: supplierId,
            purchase_date: '2026-10-13',
            items: [{ supply_id: foreignSupply, quantity: 1, unit_price: 1 }],
          })
        ).rejects.toThrow('Supply not found');

        const after = (await t.ds.query('SELECT count(*)::int c FROM purchases WHERE store_id = $1', [t.storeId]))[0].c;
        expect(after).toBe(before);
      } finally {
        await t.ds.query('DELETE FROM stores WHERE id = $1', [other.storeId]);
      }
    });
  });
});
