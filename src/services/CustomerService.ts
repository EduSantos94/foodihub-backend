import { Repository } from 'typeorm';
import { createDataSource } from '../database/connection.js';
import { CustomerModel } from '../database/models/CustomerModel.js';
import { CustomerQueries } from '../database/queries/CustomerQueries.js';
import {
  CreateCustomerRequest,
  UpdateCustomerRequest,
  CustomerResponse,
  PaginatedResponse,
  PaginationQuery,
} from '../types/index.js';

export class CustomerService {
  private queries?: CustomerQueries;

  private async ensureQueries(): Promise<CustomerQueries> {
    if (!this.queries) {
      const ds = await createDataSource();
      const customerRepo: Repository<CustomerModel> = ds.getRepository(CustomerModel);
      this.queries = new CustomerQueries(customerRepo);
    }
    return this.queries;
  }

  async createCustomer(
    storeId: string,
    data: CreateCustomerRequest
  ): Promise<CustomerResponse> {
    const q = await this.ensureQueries();

    // Check if email already exists for this store
    if (data.email) {
      const existing = await q.findCustomerByEmail(data.email, storeId);
      if (existing) throw new Error('Customer with this email already exists in this store');
    }

    const customer = await q.createCustomer({
      store_id: storeId,
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email,
      phone: data.phone,
      cpf: data.cpf,
      delivery_address: data.delivery_address,
      city: data.city,
      state: data.state,
      zip_code: data.zip_code,
      notes: data.notes,
      active: true,
    });
    return this.mapCustomer(customer);
  }

  async getCustomer(id: string, storeId: string): Promise<CustomerResponse> {
    const q = await this.ensureQueries();
    const customer = await q.findCustomerById(id, storeId);
    if (!customer) throw new Error('Customer not found');
    return this.mapCustomer(customer);
  }

  async listCustomers(
    storeId: string,
    query: PaginationQuery
  ): Promise<PaginatedResponse<CustomerResponse>> {
    const q = await this.ensureQueries();
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const [customers, total] = await q.findAllByStore(storeId, false, skip, limit);

    return {
      data: customers.map((c) => this.mapCustomer(c)),
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    };
  }

  async updateCustomer(
    id: string,
    storeId: string,
    data: UpdateCustomerRequest
  ): Promise<CustomerResponse> {
    const q = await this.ensureQueries();
    const existing = await q.findCustomerById(id, storeId);
    if (!existing) throw new Error('Customer not found');

    // If updating email, check for duplicates
    if (data.email && data.email !== existing.email) {
      const duplicate = await q.findCustomerByEmail(data.email, storeId);
      if (duplicate) throw new Error('Customer with this email already exists in this store');
    }

    const updated = await q.updateCustomer(id, storeId, {
      ...data,
      updated_at: new Date(),
    });
    return this.mapCustomer(updated!);
  }

  async deleteCustomer(id: string, storeId: string): Promise<void> {
    const q = await this.ensureQueries();
    const existing = await q.findCustomerById(id, storeId);
    if (!existing) throw new Error('Customer not found');
    await q.softDeleteCustomer(id, storeId);
  }

  private mapCustomer(c: CustomerModel): CustomerResponse {
    return {
      id: c.id,
      store_id: c.store_id,
      first_name: c.first_name,
      last_name: c.last_name,
      email: c.email,
      phone: c.phone,
      cpf: c.cpf,
      delivery_address: c.delivery_address,
      city: c.city,
      state: c.state,
      zip_code: c.zip_code,
      notes: c.notes,
      active: c.active,
      created_at: c.created_at,
      updated_at: c.updated_at,
    };
  }
}
