import { Repository } from 'typeorm';
import { createDataSource } from '../database/connection.js';
import { SupplierModel } from '../database/models/SupplierModel.js';
import { SupplierQueries } from '../database/queries/SupplierQueries.js';
import {
  CreateSupplierRequest,
  UpdateSupplierRequest,
  SupplierResponse,
  PaginatedResponse,
  PaginationQuery,
} from '../types/index.js';

export class SupplierService {
  private queries?: SupplierQueries;

  private async ensureQueries(): Promise<SupplierQueries> {
    if (!this.queries) {
      const ds = await createDataSource();
      const repo: Repository<SupplierModel> = ds.getRepository(SupplierModel);
      this.queries = new SupplierQueries(repo);
    }
    return this.queries;
  }

  async createSupplier(storeId: string, data: CreateSupplierRequest): Promise<SupplierResponse> {
    const q = await this.ensureQueries();

    if (data.cnpj) {
      const existing = await q.findSupplierByCnpj(data.cnpj, storeId);
      if (existing) throw new Error('Supplier with this CNPJ already exists in this store');
    }

    const supplier = await q.createSupplier({
      store_id: storeId,
      name: data.name,
      cnpj: data.cnpj,
      phone: data.phone,
      email: data.email,
      contact_person: data.contact_person,
      address: data.address,
      city: data.city,
      state: data.state,
      zip_code: data.zip_code,
      notes: data.notes,
      active: true,
    });
    return this.mapSupplier(supplier);
  }

  async getSupplier(id: string, storeId: string): Promise<SupplierResponse> {
    const q = await this.ensureQueries();
    const supplier = await q.findSupplierById(id, storeId);
    if (!supplier) throw new Error('Supplier not found');
    return this.mapSupplier(supplier);
  }

  async listSuppliers(
    storeId: string,
    query: PaginationQuery
  ): Promise<PaginatedResponse<SupplierResponse>> {
    const q = await this.ensureQueries();
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const [suppliers, total] = await q.findAllByStore(storeId, false, skip, limit);

    return {
      data: suppliers.map((s) => this.mapSupplier(s)),
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    };
  }

  async updateSupplier(
    id: string,
    storeId: string,
    data: UpdateSupplierRequest
  ): Promise<SupplierResponse> {
    const q = await this.ensureQueries();
    const existing = await q.findSupplierById(id, storeId);
    if (!existing) throw new Error('Supplier not found');

    if (data.cnpj && data.cnpj !== existing.cnpj) {
      const duplicate = await q.findSupplierByCnpj(data.cnpj, storeId);
      if (duplicate) throw new Error('Supplier with this CNPJ already exists in this store');
    }

    const updated = await q.updateSupplier(id, storeId, { ...data, updated_at: new Date() });
    return this.mapSupplier(updated!);
  }

  async deleteSupplier(id: string, storeId: string): Promise<void> {
    const q = await this.ensureQueries();
    const existing = await q.findSupplierById(id, storeId);
    if (!existing) throw new Error('Supplier not found');
    await q.softDeleteSupplier(id, storeId);
  }

  private mapSupplier(s: SupplierModel): SupplierResponse {
    return {
      id: s.id,
      store_id: s.store_id,
      name: s.name,
      cnpj: s.cnpj,
      phone: s.phone,
      email: s.email,
      contact_person: s.contact_person,
      address: s.address,
      city: s.city,
      state: s.state,
      zip_code: s.zip_code,
      notes: s.notes,
      active: s.active,
      created_at: s.created_at,
      updated_at: s.updated_at,
    };
  }
}
