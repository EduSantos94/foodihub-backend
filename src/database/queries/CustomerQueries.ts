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

  async softDeleteCustomer(id: string, storeId: string): Promise<boolean> {
    const result = await this.customerRepository.update(
      { id, store_id: storeId },
      { deleted_at: new Date() }
    );
    return (result.affected || 0) > 0;
  }
}
