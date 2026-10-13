import { Repository } from 'typeorm';
import { PurchaseModel } from '../models/PurchaseModel.js';
import { PurchaseItemModel } from '../models/PurchaseItemModel.js';

export class PurchaseQueries {
  constructor(
    private purchaseRepository: Repository<PurchaseModel>,
    private itemRepository: Repository<PurchaseItemModel>
  ) {}

  async createPurchase(data: Partial<PurchaseModel>): Promise<PurchaseModel> {
    const purchase = this.purchaseRepository.create(data);
    return this.purchaseRepository.save(purchase);
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

  // Adds (or removes, with a negative quantity) purchased quantities to supplies.amount.
  // Scoped by store_id so a purchase can never touch another tenant's supplies.
  async adjustSupplyStock(
    storeId: string,
    items: { supply_id: string; quantity: number }[],
    direction: 1 | -1
  ): Promise<void> {
    for (const item of items) {
      await this.itemRepository.manager.query(
        'UPDATE supplies SET amount = GREATEST(amount + $1, 0), updated_at = NOW() WHERE id = $2 AND store_id = $3',
        [direction * item.quantity, item.supply_id, storeId]
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
