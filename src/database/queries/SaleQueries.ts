import { Repository, EntityManager } from 'typeorm';
import { SaleModel } from '../models/SaleModel.js';
import { SaleItemModel } from '../models/SaleItemModel.js';
import { SaleIntegrationModel } from '../models/SaleIntegrationModel.js';
import { ProductModel } from '../models/ProductModel.js';
import { ProductSizeModel } from '../models/ProductSizeModel.js';
import { CustomerModel } from '../models/CustomerModel.js';
import { IntegrationModel } from '../models/IntegrationModel.js';

export interface StockLine {
  product_id: string;
  quantity: number;
}

export class SaleQueries {
  constructor(private saleRepository: Repository<SaleModel>) {}

  private get manager(): EntityManager {
    return this.saleRepository.manager;
  }

  // ==================== Lookups (store-scoped) ====================

  async findProductById(id: string, storeId: string): Promise<ProductModel | null> {
    return this.manager.getRepository(ProductModel).findOne({
      where: { id, store_id: storeId },
    });
  }

  async findProductSize(id: string, productId: string, storeId: string): Promise<ProductSizeModel | null> {
    return this.manager.getRepository(ProductSizeModel).findOne({
      where: { id, product_id: productId, store_id: storeId },
    });
  }

  async findCustomerById(id: string, storeId: string): Promise<CustomerModel | null> {
    return this.manager.getRepository(CustomerModel).findOne({
      where: { id, store_id: storeId },
    });
  }

  async findIntegrationById(id: string, storeId: string): Promise<IntegrationModel | null> {
    return this.manager.getRepository(IntegrationModel).findOne({
      where: { id, store_id: storeId },
    });
  }

  // ==================== Sales ====================

  /**
   * Creates the sale, its items and (optionally) the integration record, and
   * decrements products.amount atomically. Rolls back if any product has
   * insufficient stock.
   */
  async createSaleWithItems(
    saleData: Partial<SaleModel>,
    items: Partial<SaleItemModel>[],
    integration?: Partial<SaleIntegrationModel>
  ): Promise<string> {
    return this.manager.transaction(async (tx) => {
      const sale = await tx.save(SaleModel, tx.create(SaleModel, saleData));

      await tx.save(
        SaleItemModel,
        tx.create(SaleItemModel, items.map((i) => ({ ...i, sale_id: sale.id })))
      );

      await this.decrementStock(tx, saleData.store_id!, items as StockLine[]);

      if (integration) {
        await tx.save(
          SaleIntegrationModel,
          tx.create(SaleIntegrationModel, { ...integration, sale_id: sale.id })
        );
      }

      return sale.id;
    });
  }

  async findSaleById(id: string, storeId: string): Promise<SaleModel | null> {
    return this.saleRepository.findOne({
      where: { id, store_id: storeId },
      relations: ['items', 'integrations'],
    });
  }

  async findAllByStore(
    storeId: string,
    status: string | undefined,
    skip = 0,
    take = 10
  ): Promise<[SaleModel[], number]> {
    const where: any = { store_id: storeId };
    if (status) where.status = status;

    return this.saleRepository.findAndCount({
      where,
      relations: ['items', 'integrations'],
      order: { sale_date: 'DESC' },
      skip,
      take,
    });
  }

  async updateSale(id: string, storeId: string, data: Partial<SaleModel>): Promise<SaleModel | null> {
    await this.saleRepository.update({ id, store_id: storeId }, data);
    return this.findSaleById(id, storeId);
  }

  /**
   * Cancels a sale and gives the sold quantities back to products.amount.
   */
  async cancelSale(id: string, storeId: string, items: StockLine[]): Promise<void> {
    await this.manager.transaction(async (tx) => {
      await tx.update(
        SaleModel,
        { id, store_id: storeId },
        { status: 'cancelled', payment_status: 'cancelled', updated_at: new Date() }
      );

      for (const item of items) {
        await tx.query(
          'UPDATE products SET amount = amount + $1, updated_at = NOW() WHERE id = $2 AND store_id = $3',
          [item.quantity, item.product_id, storeId]
        );
      }

      await tx.update(SaleIntegrationModel, { sale_id: id }, { sync_status: 'pending' });
    });
  }

  // ==================== Stock ====================

  private async decrementStock(tx: EntityManager, storeId: string, items: StockLine[]): Promise<void> {
    for (const item of items) {
      const result = await tx.query(
        'UPDATE products SET amount = amount - $1, updated_at = NOW() WHERE id = $2 AND store_id = $3 AND amount >= $1 RETURNING id',
        [item.quantity, item.product_id, storeId]
      );
      // pg returns [rows, rowCount] for UPDATE ... RETURNING through TypeORM
      const rows = Array.isArray(result[0]) ? result[0] : result;
      if (rows.length === 0) throw new Error('Insufficient stock for product ' + item.product_id);
    }
  }
}
