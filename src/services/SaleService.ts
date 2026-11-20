import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { createDataSource } from '../database/connection.js';
import { SaleModel } from '../database/models/SaleModel.js';
import { SaleItemModel } from '../database/models/SaleItemModel.js';
import { SaleIntegrationModel } from '../database/models/SaleIntegrationModel.js';
import { SaleQueries } from '../database/queries/SaleQueries.js';
import { CustomerModel } from '../database/models/CustomerModel.js';
import { ProductModel } from '../database/models/ProductModel.js';
import { insertChunks } from '../database/queries/bulkInsert.js';
import { ImportResult, normalizeText, parseDate, runGroupedImport } from './importCommon.js';
import { buildSale, CatalogProduct, prepareSaleLine, SaleHistoryRow, SaleLine, SaleRecord, saleKeys } from './saleHistoryImport.js';
import { WebhookDispatcher, WebhookEventType } from './WebhookDispatcher.js';
import {
  CreateSaleRequest,
  UpdateSaleRequest,
  SaleResponse,
  SaleItemResponse,
  SaleIntegrationResponse,
  PaginatedResponse,
  PaginationQuery,
  SaleStatus,
} from '../types/index.js';

const round2 = (n: number): number => Math.round(n * 100) / 100;

export class SaleService {
  private queries?: SaleQueries;
  private dispatcher = new WebhookDispatcher();

  private async ensureQueries(): Promise<SaleQueries> {
    if (!this.queries) {
      const ds = await createDataSource();
      const repo: Repository<SaleModel> = ds.getRepository(SaleModel);
      this.queries = new SaleQueries(repo);
    }
    return this.queries;
  }

  async createSale(storeId: string, userId: string | undefined, data: CreateSaleRequest): Promise<SaleResponse> {
    const q = await this.ensureQueries();

    if (!data.items || data.items.length === 0) {
      throw new Error('Sale must have at least one item');
    }

    const discount = data.discount ?? 0;
    const tax = data.tax ?? 0;
    if (discount < 0 || tax < 0) throw new Error('discount and tax cannot be negative');

    if (data.customer_id) {
      const customer = await q.findCustomerById(data.customer_id, storeId);
      if (!customer) throw new Error('Customer not found');
    }

    if (data.integration) {
      const integration = await q.findIntegrationById(data.integration.integration_id, storeId);
      if (!integration) throw new Error('Integration not found');
    }

    // Build items with a snapshot of name and price; validate each product belongs to the store
    const items: Partial<SaleItemModel>[] = [];
    for (const item of data.items) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new Error('Item quantity must be a positive integer');
      }

      const product = await q.findProductById(item.product_id, storeId);
      if (!product) throw new Error('Product not found');
      if (!product.active) throw new Error(`Product "${product.name}" is inactive`);

      if (item.product_size_id) {
        const size = await q.findProductSize(item.product_size_id, product.id, storeId);
        if (!size) throw new Error('Product size not found');
      }

      const unit_price = Number(product.price);
      items.push({
        product_id: product.id,
        product_size_id: item.product_size_id,
        product_name: product.name,
        quantity: item.quantity,
        unit_price,
        total_price: round2(unit_price * item.quantity),
        notes: item.notes,
      });
    }

    const subtotal = round2(items.reduce((sum, i) => sum + Number(i.total_price), 0));
    const total_amount = round2(subtotal - discount + tax);
    if (total_amount < 0) throw new Error('discount cannot be greater than the sale total');

    const saleId = await q.createSaleWithItems(
      {
        store_id: storeId,
        customer_id: data.customer_id,
        sale_number: data.sale_number,
        delivery_type: data.delivery_type ?? 'takeout',
        delivery_address: data.delivery_address,
        subtotal,
        discount,
        tax,
        total_amount,
        status: 'pending',
        payment_method: data.payment_method ?? 'cash',
        payment_status: 'pending',
        notes: data.notes,
        created_by: userId,
      },
      items,
      data.integration
        ? {
            integration_id: data.integration.integration_id,
            origin: data.integration.origin,
            external_id: data.integration.external_id,
            external_order_number: data.integration.external_order_number,
            origin_data: data.integration.origin_data,
            sync_status: 'pending',
          }
        : undefined
    );

    const full = await q.findSaleById(saleId, storeId);
    const response = this.mapSale(full!);
    await this.emit(storeId, 'order.created', response);
    return response;
  }

  async getSale(id: string, storeId: string): Promise<SaleResponse> {
    const q = await this.ensureQueries();
    const sale = await q.findSaleById(id, storeId);
    if (!sale) throw new Error('Sale not found');
    return this.mapSale(sale);
  }

  async listSales(
    storeId: string,
    query: PaginationQuery & { status?: SaleStatus }
  ): Promise<PaginatedResponse<SaleResponse>> {
    const q = await this.ensureQueries();
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const [sales, total] = await q.findAllByStore(storeId, query.status, skip, limit);
    return {
      data: sales.map((s) => this.mapSale(s)),
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    };
  }

  async updateSale(id: string, storeId: string, data: UpdateSaleRequest): Promise<SaleResponse> {
    const q = await this.ensureQueries();
    const existing = await q.findSaleById(id, storeId);
    if (!existing) throw new Error('Sale not found');
    if (existing.status === 'cancelled') throw new Error('Cancelled sales cannot be changed');

    // Cancelling gives the stock back
    if (data.status === 'cancelled') {
      return this.cancelSale(id, storeId);
    }

    const updateData: Partial<SaleModel> = { updated_at: new Date() };
    if (data.status !== undefined) updateData.status = data.status;
    if (data.delivery_address !== undefined) updateData.delivery_address = data.delivery_address;
    if (data.payment_method !== undefined) updateData.payment_method = data.payment_method;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.payment_status !== undefined) {
      updateData.payment_status = data.payment_status;
      if (data.payment_status === 'paid' && !existing.paid_at) updateData.paid_at = new Date();
    }

    const updated = await q.updateSale(id, storeId, updateData);
    const response = this.mapSale(updated!);
    await this.emit(storeId, 'order.updated', response);
    return response;
  }

  async cancelSale(id: string, storeId: string): Promise<SaleResponse> {
    const q = await this.ensureQueries();
    const existing = await q.findSaleById(id, storeId);
    if (!existing) throw new Error('Sale not found');
    if (existing.status === 'cancelled') throw new Error('Sale is already cancelled');
    if (existing.status === 'delivered') throw new Error('Delivered sales cannot be cancelled');

    await q.cancelSale(
      id,
      storeId,
      (existing.items ?? []).map((i: SaleItemModel) => ({ product_id: i.product_id, quantity: Number(i.quantity) }))
    );

    const updated = await q.findSaleById(id, storeId);
    const response = this.mapSale(updated!);
    await this.emit(storeId, 'order.cancelled', response);
    return response;
  }

  /**
   * Imports the sales history from a spreadsheet with one row per item sold. Rows of the same customer,
   * day, payment method and situation become one order with its items (prices as of the day). It never
   * changes product stock and never fires webhooks. Customers are matched by name; products by name, and
   * a product that is not in the catalog is created inactive (unless `create_missing_products` is false).
   * `default_date` dates the rows that have none. `dry_run` only reports. An order that already exists
   * is skipped. Returns a `batch_id` that undoSaleHistory understands.
   */
  async importSaleHistory(
    storeId: string,
    rows: SaleHistoryRow[],
    options: { dry_run?: boolean; default_date?: string; create_missing_products?: boolean; group_lines?: boolean } = {}
  ): Promise<ImportResult> {
    const defaultText = (options.default_date ?? '').trim();
    const defaultDate = defaultText ? parseDate(defaultText) : null;
    if (defaultText && !defaultDate) throw new Error('default_date is not a valid date');
    const createMissing = options.create_missing_products !== false;
    const groupLines = options.group_lines !== false;
    const dryRun = options.dry_run === true;

    const ds = await createDataSource();
    const customers = new Map<string, string>();
    for (const c of await ds.getRepository(CustomerModel).find({ where: { store_id: storeId }, select: ['id', 'first_name', 'last_name'] })) {
      const key = normalizeText(`${c.first_name} ${c.last_name ?? ''}`);
      if (!customers.has(key)) customers.set(key, c.id);
    }
    const products = new Map<string, CatalogProduct>();
    for (const p of await ds.getRepository(ProductModel).find({ where: { store_id: storeId }, select: ['id', 'name', 'price'] })) {
      const key = normalizeText(p.name);
      if (!products.has(key)) products.set(key, { id: p.id, name: p.name, price: Number(p.price) });
    }

    const known = new Set<string>();
    const stamp = (d: Date | string) => (d instanceof Date ? d.toISOString().slice(0, 19).replace('T', ' ') : String(d));
    for (const sale of await ds.getRepository(SaleModel).find({
      where: { store_id: storeId },
      select: ['sale_number', 'sale_date', 'customer_id', 'payment_method', 'payment_status', 'total_amount'],
    })) {
      for (const key of saleKeys({ at: stamp(sale.sale_date), customer: sale.customer_id ?? '', method: sale.payment_method, paymentStatus: sale.payment_status, total: Number(sale.total_amount), number: sale.sale_number })) known.add(key);
    }

    const batchId = randomUUID();
    let counter = 0;
    const result = await runGroupedImport<SaleLine, SaleRecord>(rows, dryRun, {
      prepare: (raw) => prepareSaleLine(raw, { defaultDate: defaultDate ?? undefined, customers, products, createMissingProducts: createMissing }),
      groupKey: (l) =>
        l.number
          ? `n|${normalizeText(l.number)}`
          : `${l.date.date}|${l.date.time ?? ''}|${l.customerKey}|${l.method}|${l.paymentStatus}${groupLines ? '' : `|${counter++}`}`,
      build: buildSale,
      check: (record) => {
        const keys = saleKeys({ at: record.at, customer: record.customerId ?? '', method: record.method, paymentStatus: record.paymentStatus, total: record.total, number: record.number });
        if (keys.some((k) => known.has(k))) return 'same';
        keys.forEach((k) => known.add(k));
        return undefined;
      },
      insert: (records) =>
        ds.transaction(async (manager) => {
          // products that were sold but are not in the catalog: created inactive, priced as the sale was
          const created = new Map<string, string>();
          const newProducts: Record<string, unknown>[] = [];
          for (const r of records) {
            for (const item of r.items) {
              const key = normalizeText(item.productName);
              if (item.productId || created.has(key)) continue;
              const id = randomUUID();
              created.set(key, id);
              newProducts.push({ id, store_id: storeId, name: item.productName, price: item.unitPrice, amount: 0, active: false, import_batch_id: batchId });
            }
          }
          await insertChunks(manager, ProductModel, newProducts);

          const saleRows: Record<string, unknown>[] = [];
          const itemRows: Record<string, unknown>[] = [];
          for (const r of records) {
            const id = randomUUID();
            saleRows.push({
              id,
              store_id: storeId,
              customer_id: r.customerId,
              sale_number: r.number,
              sale_date: r.at,
              delivery_type: 'takeout',
              subtotal: r.subtotal,
              discount: r.discount,
              tax: 0,
              total_amount: r.total,
              status: r.paymentStatus === 'cancelled' ? 'cancelled' : 'delivered',
              payment_method: r.method,
              payment_status: r.paymentStatus,
              paid_at: r.paymentStatus === 'paid' ? r.at : undefined,
              notes: r.notes,
              import_batch_id: batchId,
              created_at: r.at,
              updated_at: r.at,
            });
            for (const item of r.items) {
              itemRows.push({
                sale_id: id,
                product_id: item.productId ?? created.get(normalizeText(item.productName)),
                product_name: item.productName,
                quantity: item.quantity,
                unit_price: item.unitPrice,
                total_price: item.totalPrice,
              });
            }
          }
          await insertChunks(manager, SaleModel, saleRows);
          await insertChunks(manager, SaleItemModel, itemRows);
        }),
    });
    if (!dryRun && (result.records ?? 0) > 0) result.batch_id = batchId;
    return result;
  }

  /** Removes everything one sales-history import created: its orders (and items), and the products it created that no other sale uses. */
  async undoSaleHistory(storeId: string, batchId: string): Promise<{ deleted_sales: number; deleted_products: number }> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(batchId)) throw new Error('Invalid batch id');
    const ds = await createDataSource();
    const counts = await ds.transaction(async (manager) => {
      const sales = await manager.createQueryBuilder().delete().from(SaleModel).where('store_id = :storeId AND import_batch_id = :batchId', { storeId, batchId }).execute();
      const products = await manager
        .createQueryBuilder()
        .delete()
        .from(ProductModel)
        .where('store_id = :storeId AND import_batch_id = :batchId AND NOT EXISTS (SELECT 1 FROM sale_items si WHERE si.product_id = products.id)', { storeId, batchId })
        .execute();
      return { deleted_sales: sales.affected ?? 0, deleted_products: products.affected ?? 0 };
    });
    if (counts.deleted_sales === 0 && counts.deleted_products === 0) throw new Error('Import batch not found');
    return counts;
  }

  /** Queues webhook events; a failure here must never break the sale itself. */
  private async emit(storeId: string, type: WebhookEventType, sale: SaleResponse): Promise<void> {
    try {
      await this.dispatcher.enqueue(storeId, type, sale);
    } catch (err) {
      console.error(`Failed to queue ${type} webhook for sale ${sale.id}:`, err);
    }
  }

  private mapItem(i: SaleItemModel): SaleItemResponse {
    return {
      id: i.id,
      sale_id: i.sale_id,
      product_id: i.product_id,
      product_size_id: i.product_size_id,
      product_name: i.product_name,
      quantity: Number(i.quantity),
      unit_price: Number(i.unit_price),
      total_price: Number(i.total_price),
      notes: i.notes,
    };
  }

  private mapIntegration(i: SaleIntegrationModel): SaleIntegrationResponse {
    return {
      id: i.id,
      sale_id: i.sale_id,
      integration_id: i.integration_id,
      origin: i.origin,
      external_id: i.external_id,
      external_order_number: i.external_order_number,
      origin_data: i.origin_data,
      sync_status: i.sync_status,
      last_sync: i.last_sync,
    };
  }

  private mapSale(s: SaleModel): SaleResponse {
    const integration = (s.integrations as SaleIntegrationModel[] | undefined)?.[0];
    return {
      id: s.id,
      store_id: s.store_id,
      customer_id: s.customer_id,
      sale_number: s.sale_number,
      sale_date: s.sale_date,
      delivery_type: s.delivery_type,
      delivery_address: s.delivery_address,
      subtotal: Number(s.subtotal),
      discount: Number(s.discount),
      tax: Number(s.tax),
      total_amount: Number(s.total_amount),
      status: s.status,
      payment_method: s.payment_method,
      payment_status: s.payment_status,
      paid_at: s.paid_at,
      notes: s.notes,
      created_by: s.created_by,
      items: (s.items as SaleItemModel[] | undefined)?.map((i) => this.mapItem(i)),
      integration: integration ? this.mapIntegration(integration) : undefined,
      created_at: s.created_at,
      updated_at: s.updated_at,
    };
  }
}
