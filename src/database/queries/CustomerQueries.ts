import { Repository } from 'typeorm';
import { CustomerModel } from '../models/CustomerModel.js';

export class CustomerQueries {
  constructor(private customerRepository: Repository<CustomerModel>) {}

  async createCustomer(data: Partial<CustomerModel>): Promise<CustomerModel> {
    const customer = this.customerRepository.create(data);
    return this.customerRepository.save(customer);
  }

  async findCustomerById(id: string, storeId: string): Promise<CustomerModel | null> {
    return this.customerRepository.findOne({
      where: { id, store_id: storeId, deleted_at: undefined },
    });
  }

  async findCustomerByEmail(email: string, storeId: string): Promise<CustomerModel | null> {
    return this.customerRepository.findOne({
      where: { email, store_id: storeId, deleted_at: undefined },
    });
  }

  async findAllByStore(
    storeId: string,
    onlyActive = false,
    skip = 0,
    take = 10
  ): Promise<[CustomerModel[], number]> {
    const where: any = { store_id: storeId, deleted_at: undefined };
    if (onlyActive) where.active = true;

    return this.customerRepository.findAndCount({
      where,
      order: { created_at: 'DESC' },
      skip,
      take,
    });
  }

  async updateCustomer(
    id: string,
    storeId: string,
    data: Partial<CustomerModel>
  ): Promise<CustomerModel | null> {
    await this.customerRepository.update({ id, store_id: storeId }, data);
    return this.findCustomerById(id, storeId);
  }

  /** Names, e-mails, CPFs and phones of the store's customers (to spot duplicates on import) */
  async findContactKeys(storeId: string): Promise<{ first_name: string; last_name?: string; email?: string; cpf?: string; phone?: string }[]> {
    return this.customerRepository
      .createQueryBuilder('c')
      .select(['c.first_name', 'c.last_name', 'c.email', 'c.cpf', 'c.phone'])
      .where('c.store_id = :storeId', { storeId })
      .getMany();
  }

  /** Inserts all rows or none: a database error rolls the whole import back. */
  async bulkCreate(storeId: string, rows: Partial<CustomerModel>[], chunkSize = 500): Promise<void> {
    await this.customerRepository.manager.transaction(async (manager) => {
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize).map((r) => ({ ...r, store_id: storeId, active: true }));
        await manager.createQueryBuilder().insert().into(CustomerModel).values(chunk).execute();
      }
    });
  }

  async softDeleteCustomer(id: string, storeId: string): Promise<boolean> {
    const result = await this.customerRepository.update(
      { id, store_id: storeId },
      { deleted_at: new Date() }
    );
    return (result.affected || 0) > 0;
  }
}
