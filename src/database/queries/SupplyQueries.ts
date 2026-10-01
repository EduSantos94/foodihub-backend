import { Repository } from 'typeorm';
import { SupplyModel } from '../models/SupplyModel.js';

export class SupplyQueries {
  constructor(private supplyRepository: Repository<SupplyModel>) {}

  async createSupply(data: Partial<SupplyModel>): Promise<SupplyModel> {
    const supply = this.supplyRepository.create(data);
    return this.supplyRepository.save(supply);
  }

  async findSupplyById(id: string, storeId: string): Promise<SupplyModel | null> {
    return this.supplyRepository.findOne({
      where: { id, store_id: storeId, active: undefined },
    });
  }

  async findSupplyByName(name: string, storeId: string): Promise<SupplyModel | null> {
    return this.supplyRepository.findOne({
      where: { name, store_id: storeId },
    });
  }

  async findAllByStore(
    storeId: string,
    onlyActive = false,
    skip = 0,
    take = 10
  ): Promise<[SupplyModel[], number]> {
    const where: any = { store_id: storeId };
    if (onlyActive) where.active = true;

    return this.supplyRepository.findAndCount({
      where,
      order: { name: 'ASC' },
      skip,
      take,
    });
  }

  async updateSupply(id: string, storeId: string, data: Partial<SupplyModel>): Promise<SupplyModel | null> {
    await this.supplyRepository.update({ id, store_id: storeId }, data);
    return this.findSupplyById(id, storeId);
  }

  async deleteSupply(id: string, storeId: string): Promise<boolean> {
    const result = await this.supplyRepository.delete({ id, store_id: storeId });
    return (result.affected || 0) > 0;
  }
}
