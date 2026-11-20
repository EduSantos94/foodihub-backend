import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { createDataSource } from '../database/connection.js';
import { PurchaseModel } from '../database/models/PurchaseModel.js';
import { PurchaseItemModel } from '../database/models/PurchaseItemModel.js';
import { PurchaseQueries } from '../database/queries/PurchaseQueries.js';
import { SupplierModel } from '../database/models/SupplierModel.js';
import { insertChunks } from '../database/queries/bulkInsert.js';
import { ImportResult, normalizeText, parseDate, runGroupedImport } from './importCommon.js';
import { buildPurchase, PurchaseHistoryRow, PurchaseLine, preparePurchaseLine, purchaseKeys, PurchaseRecord } from './purchaseHistoryImport.js';
import {
  CreatePurchaseRequest,
  UpdatePurchaseRequest,
  PurchaseResponse,
  PurchaseItemResponse,
  PaginatedResponse,
  PaginationQuery,
} from '../types/index.js';

export class PurchaseService {
  private queries?: PurchaseQueries;

  private async ensureQueries(): Promise<PurchaseQueries> {
    if (!this.queries) {
      const ds = await createDataSource();
      const purchaseRepo: Repository<PurchaseModel> = ds.getRepository(PurchaseModel);
      const itemRepo: Repository<PurchaseItemModel> = ds.getRepository(PurchaseItemModel);
      this.queries = new PurchaseQueries(purchaseRepo, itemRepo);
    }
    return this.queries;
  }

  async createPurchase(storeId: string, data: CreatePurchaseRequest): Promise<PurchaseResponse> {
    const q = await this.ensureQueries();

    if (!data.items || data.items.length === 0) {
      throw new Error('Purchase must have at least one item');
    }

    // Calculate total from items
    const total_amount = data.items.reduce((sum, item) => {
      return sum + item.quantity * item.unit_price;
    }, 0);

    // Supplier and supplies must belong to this store (tenant isolation)
    const supplier = await q.findSupplierById(data.supplier_id, storeId);
    if (!supplier) throw new Error('Supplier not found');

    for (const item of data.items) {
      if (!(item.quantity > 0)) throw new Error('Item quantity must be greater than zero');
      if (item.unit_price < 0) throw new Error('Item unit_price cannot be negative');
    }

    const supplyIds = [...new Set(data.items.map((i) => i.supply_id))];
    const found = await q.countSuppliesInStore(supplyIds, storeId);
    if (found !== supplyIds.length) throw new Error('Supply not found');

    const itemsData = data.items.map((item) => ({
      supply_id: item.supply_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.quantity * item.unit_price,
      batch_number: item.batch_number,
      manufacturing_date: item.manufacturing_date ? new Date(item.manufacturing_date) : undefined,
      expiry_date: item.expiry_date ? new Date(item.expiry_date) : undefined,
    }));

    // Purchase, items and the supplies.amount increase are saved in one transaction
    const purchaseId = await q.createPurchaseWithItems(
      {
        store_id: storeId,
        supplier_id: data.supplier_id,
        purchase_number: data.purchase_number,
        purchase_date: new Date(data.purchase_date),
        delivery_date: data.delivery_date ? new Date(data.delivery_date) : undefined,
        invoice_number: data.invoice_number,
        invoice_date: data.invoice_date ? new Date(data.invoice_date) : undefined,
        total_amount,
        paid_amount: 0,
        payment_status: 'pending',
        payment_method: data.payment_method,
        notes: data.notes,
      },
      itemsData
    );

    const full = await q.findPurchaseById(purchaseId, storeId);
    return this.mapPurchase(full!);
  }

  async getPurchase(id: string, storeId: string): Promise<PurchaseResponse> {
    const q = await this.ensureQueries();
    const purchase = await q.findPurchaseById(id, storeId);
    if (!purchase) throw new Error('Purchase not found');
    return this.mapPurchase(purchase);
  }

  async listPurchases(
    storeId: string,
    query: PaginationQuery
  ): Promise<PaginatedResponse<PurchaseResponse>> {
    const q = await this.ensureQueries();
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const [purchases, total] = await q.findAllByStore(storeId, skip, limit);
    return {
      data: purchases.map((p) => this.mapPurchase(p)),
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    };
  }

  async updatePurchase(id: string, storeId: string, data: UpdatePurchaseRequest): Promise<PurchaseResponse> {
    const q = await this.ensureQueries();
    const existing = await q.findPurchaseById(id, storeId);
    if (!existing) throw new Error('Purchase not found');

    const updateData: Partial<PurchaseModel> = { updated_at: new Date() };
    if (data.purchase_number !== undefined) updateData.purchase_number = data.purchase_number;
    if (data.invoice_number !== undefined) updateData.invoice_number = data.invoice_number;
    if (data.paid_amount !== undefined) updateData.paid_amount = data.paid_amount;
    if (data.payment_status !== undefined) updateData.payment_status = data.payment_status;
    if (data.payment_method !== undefined) updateData.payment_method = data.payment_method;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.purchase_date) updateData.purchase_date = new Date(data.purchase_date) as any;
    if (data.delivery_date) updateData.delivery_date = new Date(data.delivery_date) as any;
    if (data.invoice_date) updateData.invoice_date = new Date(data.invoice_date) as any;
    if (data.payment_date) updateData.payment_date = new Date(data.payment_date) as any;

    const updated = await q.updatePurchase(id, storeId, updateData);
    return this.mapPurchase(updated!);
  }

  async deletePurchase(id: string, storeId: string): Promise<void> {
    const q = await this.ensureQueries();
    const existing = await q.findPurchaseById(id, storeId);
    if (!existing) throw new Error('Purchase not found');
    await q.deletePurchaseAndRevertStock(
      id,
      storeId,
      (existing.items ?? []).map((i: PurchaseItemModel) => ({ supply_id: i.supply_id, quantity: Number(i.quantity) }))
    );
  }

  /**
   * Imports the purchases history from a spreadsheet with one row per item. Rows of the same supplier,
   * date and situation become one purchase (its items listed in the notes). It never changes supplies
   * stock. Suppliers that do not exist are created (unless `create_missing_suppliers` is false).
   * `default_date` dates the rows that have none. `dry_run` only reports. A purchase that already exists
   * (same number, or same supplier, date, total and situation) is skipped. Returns a `batch_id` that
   * undoPurchaseHistory understands.
   */
  async importPurchaseHistory(
    storeId: string,
    rows: PurchaseHistoryRow[],
    options: { dry_run?: boolean; default_date?: string; create_missing_suppliers?: boolean; group_lines?: boolean } = {}
  ): Promise<ImportResult> {
    const defaultText = (options.default_date ?? '').trim();
    const defaultDate = defaultText ? parseDate(defaultText) : null;
    if (defaultText && !defaultDate) throw new Error('default_date is not a valid date');
    const createMissing = options.create_missing_suppliers !== false;
    const groupLines = options.group_lines !== false;
    const dryRun = options.dry_run === true;

    const ds = await createDataSource();
    const suppliers = new Map<string, string>();
    const supplierName = new Map<string, string>();
    for (const sup of await ds.getRepository(SupplierModel).find({ where: { store_id: storeId }, select: ['id', 'name'] })) {
      suppliers.set(normalizeText(sup.name), sup.id);
      supplierName.set(sup.id, sup.name);
    }

    const known = new Set<string>();
    const existing = await ds.getRepository(PurchaseModel).find({
      where: { store_id: storeId },
      select: ['supplier_id', 'purchase_date', 'total_amount', 'payment_status', 'purchase_number'],
    });
    for (const p of existing) {
      const date = p.purchase_date instanceof Date ? p.purchase_date.toISOString().slice(0, 10) : String(p.purchase_date).slice(0, 10);
      for (const key of purchaseKeys({ date, supplier: supplierName.get(p.supplier_id) ?? '', total: Number(p.total_amount), status: p.payment_status, number: p.purchase_number })) known.add(key);
    }

    const batchId = randomUUID();
    let counter = 0;
    const result = await runGroupedImport<PurchaseLine, PurchaseRecord>(rows, dryRun, {
      prepare: (raw) => preparePurchaseLine(raw, { defaultDate: defaultDate ?? undefined, suppliers, createMissingSuppliers: createMissing }),
      groupKey: (l) => `${l.date}|${normalizeText(l.supplier)}|${l.status}|${l.method}|${l.number ?? ''}|${l.invoice ?? ''}${groupLines ? '' : `|${counter++}`}`,
      build: buildPurchase,
      check: (record) => {
        const keys = purchaseKeys(record);
        if (keys.some((k) => known.has(k))) return record.number ? 'number' : 'same';
        keys.forEach((k) => known.add(k));
        return undefined;
      },
      insert: (records) =>
        ds.transaction(async (manager) => {
          const ids = new Map(suppliers);
          const created: Record<string, unknown>[] = [];
          for (const r of records) {
            const key = normalizeText(r.supplier);
            if (!ids.has(key)) {
              const id = randomUUID();
              ids.set(key, id);
              created.push({ id, store_id: storeId, name: r.supplier, active: true, import_batch_id: batchId });
            }
          }
          await insertChunks(manager, SupplierModel, created);
          await insertChunks(
            manager,
            PurchaseModel,
            records.map((r) => ({
              store_id: storeId,
              supplier_id: ids.get(normalizeText(r.supplier)),
              purchase_number: r.number,
              purchase_date: r.date,
              invoice_number: r.invoice,
              total_amount: r.total,
              paid_amount: r.status === 'paid' ? r.total : 0,
              payment_status: r.status,
              payment_method: r.method,
              payment_date: r.status === 'paid' ? r.date : undefined,
              notes: r.notes,
              import_batch_id: batchId,
            }))
          );
        }),
    });
    if (!dryRun && (result.records ?? 0) > 0) result.batch_id = batchId;
    return result;
  }

  /** Removes everything one purchases-history import created: its purchases, and the suppliers it created that nothing else uses. */
  async undoPurchaseHistory(storeId: string, batchId: string): Promise<{ deleted_purchases: number; deleted_suppliers: number }> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(batchId)) throw new Error('Invalid batch id');
    const ds = await createDataSource();
    const counts = await ds.transaction(async (manager) => {
      const purchases = await manager
        .createQueryBuilder()
        .delete()
        .from(PurchaseModel)
        .where('store_id = :storeId AND import_batch_id = :batchId', { storeId, batchId })
        .execute();
      const suppliers = await manager
        .createQueryBuilder()
        .delete()
        .from(SupplierModel)
        .where('store_id = :storeId AND import_batch_id = :batchId AND NOT EXISTS (SELECT 1 FROM purchases p WHERE p.supplier_id = suppliers.id)', { storeId, batchId })
        .execute();
      return { deleted_purchases: purchases.affected ?? 0, deleted_suppliers: suppliers.affected ?? 0 };
    });
    if (counts.deleted_purchases === 0 && counts.deleted_suppliers === 0) throw new Error('Import batch not found');
    return counts;
  }

  private mapItem(i: PurchaseItemModel): PurchaseItemResponse {
    return {
      id: i.id,
      purchase_id: i.purchase_id,
      supply_id: i.supply_id,
      quantity: Number(i.quantity),
      unit_price: Number(i.unit_price),
      total_price: Number(i.total_price),
      batch_number: i.batch_number,
      manufacturing_date: i.manufacturing_date,
      expiry_date: i.expiry_date,
    };
  }

  private mapPurchase(p: PurchaseModel): PurchaseResponse {
    return {
      id: p.id,
      store_id: p.store_id,
      supplier_id: p.supplier_id,
      purchase_number: p.purchase_number,
      purchase_date: p.purchase_date,
      delivery_date: p.delivery_date,
      invoice_number: p.invoice_number,
      invoice_date: p.invoice_date,
      total_amount: Number(p.total_amount),
      paid_amount: Number(p.paid_amount),
      payment_status: p.payment_status,
      payment_method: p.payment_method,
      payment_date: p.payment_date,
      notes: p.notes,
      items: (p.items as PurchaseItemModel[] | undefined)?.map((i) => this.mapItem(i)),
      created_at: p.created_at,
      updated_at: p.updated_at,
    };
  }
}
