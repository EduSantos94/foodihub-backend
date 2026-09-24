import { Repository, FindOptionsWhere, ILike } from 'typeorm';
import { SupplyModel, SupplyType } from '../models/SupplyModel.js';

export interface FindSuppliesOptions {
  type?: SupplyType;
  active?: boolean;
  search?: string;
  skip?: number;
  take?: number;
}

export class SupplyQueries {
  constructor(private supplyRepository: Repository<SupplyModel>) {}

  async createSupply(data: Partial<SupplyModel>): Promise<SupplyModel> {
    const supply = this.supplyRepository.create(data);
    return this.supplyRepository.save(supply);
  }

  async findSupplyById(id: number, storeId: string): Promise<SupplyModel | null> {
    return this.supplyRepository.findOne({
      where: { id, store_id: storeId },
    });
  }

  async findSupplyByName(name: string, storeId: string): Promise<SupplyModel | null> {
    return this.supplyRepository.findOne({
      where: { name, store_id: storeId },
    });
  }

  async findAllByStore(
    storeId: string,
    options: FindSuppliesOptions = {}
  ): Promise<[SupplyModel[], number]> {
    const { type, active, search, skip = 0, take = 10 } = options;
    const where: FindOptionsWhere<SupplyModel> = { store_id: storeId };

    if (type !== undefined) {
      where.type = type;
    }
    if (active !== undefined) {
      where.active = active;
    }
    if (search) {
      where.name = ILike(`%${search}%`);
    }

    return this.supplyRepository.findAndCount({
      where,
      order: { name: 'ASC' },
      skip,
      take,
    });
  }

  async updateSupply(
    id: number,
    storeId: string,
    data: Partial<SupplyModel>
  ): Promise<SupplyModel | null> {
    await this.supplyRepository.update({ id, store_id: storeId }, data);
    return this.findSupplyById(id, storeId);
  }

  async deleteSupply(id: number, storeId: string): Promise<boolean> {
    const result = await this.supplyRepository.delete({ id, store_id: storeId });
    return (result.affected || 0) > 0;
  }
}
