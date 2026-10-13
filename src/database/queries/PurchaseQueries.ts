import { Repository, EntityManager, In } from 'typeorm';
import { PurchaseModel } from '../models/PurchaseModel.js';
import { PurchaseItemModel } from '../models/PurchaseItemModel.js';
import { SupplierModel } from '../models/SupplierModel.js';
import { SupplyModel } from '../models/SupplyModel.js';

export interface SupplyLine {
  supply_id: string;
  quantity: number;
}

export class PurchaseQueries {
  constructor(
    private purchaseRepository: Repository<PurchaseModel>,
    private itemRepository: Repository<PurchaseItemModel>
  ) {}

  async createPurchase(data: Partial<PurchaseModel>): Promise<PurchaseModel> {
    const purchase = this.purchaseRepository.create(data);
    return this.purchaseRepository.save(purchase);
  }

  async findSupplierById(id: string, storeId: string): Promise<SupplierModel | null> {
    return this.purchaseRepository.manager.getRepository(SupplierModel).findOne({
      where: { id, store_id: storeId },
    });
  }

  /** How many of the given supply ids belong to the store. */
  async countSuppliesInStore(ids: string[], storeId: string): Promise<number> {
    if (ids.length === 0) return 0;
    return this.purchaseRepository.manager.getRepository(SupplyModel).count({
      where: { id: In(ids), store_id: storeId },
    });
  }

  /**
   * Creates the purchase, its items and adds the quantities to supplies.amount in a single
   * transaction: either everything is saved or nothing is.
   */
  async createPurchaseWithItems(
    purchaseData: Partial<PurchaseModel>,
    items: Partial<PurchaseItemModel>[]
  ): Promise<string> {
    return this.purchaseRepository.manager.transaction(async (tx) => {
      const purchase = await tx.save(PurchaseModel, tx.create(PurchaseModel, purchaseData));
      await tx.save(
        PurchaseItemModel,
        tx.create(PurchaseItemModel, items.map((i) => ({ ...i, purchase_id: purchase.id })))
      );
      await this.applySupplyStock(tx, purchaseData.store_id!, items as SupplyLine[], 1);
      return purchase.id;
    });
  }

  /** Deletes the purchase and takes its quantities back out of supplies.amount, atomically. */
  async deletePurchaseAndRevertStock(id: string, storeId: string, items: SupplyLine[]): Promise<boolean> {
    return this.purchaseRepository.manager.transaction(async (tx) => {
      const result = await tx.delete(PurchaseModel, { id, store_id: storeId });
      if ((result.affected || 0) === 0) return false;
      await this.applySupplyStock(tx, storeId, items, -1);
      return true;
    });
  }

  async createItems(items: Partial<PurchaseItemModel>[]): Promise<PurchaseItemModel[]> {
    const created = this.itemRepository.create(items);
    return this.itemRepository.save(created);
  }

  async findPurchaseById(id: string, storeId: string): Promise<PurchaseModel | null> {
    return this.purchaseRepository.findOne({
      where: { id, store_id: storeId },
      relations: ['items'],
    });
  }

  async findAllByStore(
    storeId: string,
    skip = 0,
    take = 10
  ): Promise<[PurchaseModel[], number]> {
    return this.purchaseRepository.findAndCount({
      where: { store_id: storeId },
      relations: ['items'],
      order: { purchase_date: 'DESC' },
      skip,
      take,
    });
  }

  async updatePurchase(id: string, storeId: string, data: Partial<PurchaseModel>): Promise<PurchaseModel | null> {
    await this.purchaseRepository.update({ id, store_id: storeId }, data);
    return this.findPurchaseById(id, storeId);
  }

  async deletePurchase(id: string, storeId: string): Promise<boolean> {
    const result = await this.purchaseRepository.delete({ id, store_id: storeId });
    return (result.affected || 0) > 0;
  }

  // Adds (direction 1) or removes (direction -1) quantities from supplies.amount, never below 0.
  // Scoped by store_id so a purchase can never touch another tenant's supplies.
  private async applySupplyStock(
    tx: EntityManager,
    storeId: string,
    items: SupplyLine[],
    direction: 1 | -1
  ): Promise<void> {
    for (const item of items) {
      await tx.query(
        'UPDATE supplies SET amount = GREATEST(amount + $1, 0), updated_at = NOW() WHERE id = $2 AND store_id = $3',
        [direction * Number(item.quantity), item.supply_id, storeId]
      );
    }
  }

  async deleteItemsByPurchase(purchaseId: string): Promise<void> {
    await this.itemRepository.delete({ purchase_id: purchaseId });
  }

  async findItemsByPurchase(purchaseId: string): Promise<PurchaseItemModel[]> {
    return this.itemRepository.find({
      where: { purchase_id: purchaseId },
    });
  }
}
