import { Repository } from 'typeorm';
import { SupplierModel } from '../models/SupplierModel.js';

export class SupplierQueries {
  constructor(private supplierRepository: Repository<SupplierModel>) {}

  async createSupplier(data: Partial<SupplierModel>): Promise<SupplierModel> {
    const supplier = this.supplierRepository.create(data);
    return this.supplierRepository.save(supplier);
  }

  async findSupplierById(id: string, storeId: string): Promise<SupplierModel | null> {
    return this.supplierRepository.findOne({
      where: { id, store_id: storeId, deleted_at: undefined },
    });
  }

  async findSupplierByCnpj(cnpj: string, storeId: string): Promise<SupplierModel | null> {
    return this.supplierRepository.findOne({
      where: { cnpj, store_id: storeId, deleted_at: undefined },
    });
  }

  async findAllByStore(
    storeId: string,
    onlyActive = false,
    skip = 0,
    take = 10
  ): Promise<[SupplierModel[], number]> {
    const where: any = { store_id: storeId, deleted_at: undefined };
    if (onlyActive) where.active = true;

    return this.supplierRepository.findAndCount({
      where,
      order: { name: 'ASC' },
      skip,
      take,
    });
  }

  async updateSupplier(
    id: string,
    storeId: string,
    data: Partial<SupplierModel>
  ): Promise<SupplierModel | null> {
    await this.supplierRepository.update({ id, store_id: storeId }, data);
    return this.findSupplierById(id, storeId);
  }

  async softDeleteSupplier(id: string, storeId: string): Promise<boolean> {
    const result = await this.supplierRepository.update(
      { id, store_id: storeId },
      { deleted_at: new Date() }
    );
    return (result.affected || 0) > 0;
  }
}
