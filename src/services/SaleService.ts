import { Repository } from 'typeorm';
import { createDataSource } from '../database/connection.js';
import { SaleModel } from '../database/models/SaleModel.js';
import { SaleItemModel } from '../database/models/SaleItemModel.js';
import { SaleIntegrationModel } from '../database/models/SaleIntegrationModel.js';
import { SaleQueries } from '../database/queries/SaleQueries.js';
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
