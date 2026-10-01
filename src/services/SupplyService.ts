import { Repository } from 'typeorm';
import { createDataSource } from '../database/connection.js';
import { SupplyModel } from '../database/models/SupplyModel.js';
import { SupplyQueries } from '../database/queries/SupplyQueries.js';
import {
  CreateSupplyRequest,
  UpdateSupplyRequest,
  SupplyResponse,
  PaginatedResponse,
  PaginationQuery,
} from '../types/index.js';

export class SupplyService {
  private queries?: SupplyQueries;

  private async ensureQueries(): Promise<SupplyQueries> {
    if (!this.queries) {
      const ds = await createDataSource();
      const repo: Repository<SupplyModel> = ds.getRepository(SupplyModel);
      this.queries = new SupplyQueries(repo);
    }
    return this.queries;
  }

  async createSupply(storeId: string, data: CreateSupplyRequest): Promise<SupplyResponse> {
    const q = await this.ensureQueries();

    const existing = await q.findSupplyByName(data.name, storeId);
    if (existing) throw new Error('Supply with this name already exists in this store');

    const supply = await q.createSupply({
      store_id: storeId,
      name: data.name,
      type: data.type ?? 'ingredient',
      unit_measure: data.unit_measure,
      description: data.description,
      active: true,
    });
    return this.mapSupply(supply);
  }

  async getSupply(id: string, storeId: string): Promise<SupplyResponse> {
    const q = await this.ensureQueries();
    const supply = await q.findSupplyById(id, storeId);
    if (!supply) throw new Error('Supply not found');
    return this.mapSupply(supply);
  }

  async listSupplies(
    storeId: string,
    query: PaginationQuery
  ): Promise<PaginatedResponse<SupplyResponse>> {
    const q = await this.ensureQueries();
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const [supplies, total] = await q.findAllByStore(storeId, false, skip, limit);
    return {
      data: supplies.map((s) => this.mapSupply(s)),
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    };
  }

  async updateSupply(id: string, storeId: string, data: UpdateSupplyRequest): Promise<SupplyResponse> {
    const q = await this.ensureQueries();
    const existing = await q.findSupplyById(id, storeId);
    if (!existing) throw new Error('Supply not found');

    if (data.name && data.name !== existing.name) {
      const duplicate = await q.findSupplyByName(data.name, storeId);
      if (duplicate) throw new Error('Supply with this name already exists in this store');
    }

    const updated = await q.updateSupply(id, storeId, { ...data, updated_at: new Date() });
    return this.mapSupply(updated!);
  }

  async deleteSupply(id: string, storeId: string): Promise<void> {
    const q = await this.ensureQueries();
    const existing = await q.findSupplyById(id, storeId);
    if (!existing) throw new Error('Supply not found');
    await q.deleteSupply(id, storeId);
  }

  private mapSupply(s: SupplyModel): SupplyResponse {
    return {
      id: s.id,
      store_id: s.store_id,
      name: s.name,
      type: s.type,
      unit_measure: s.unit_measure,
      description: s.description,
      active: s.active,
      created_at: s.created_at,
      updated_at: s.updated_at,
    };
  }
}
