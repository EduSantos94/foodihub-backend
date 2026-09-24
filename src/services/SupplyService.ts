import { Repository } from 'typeorm';
import { createDataSource } from '../database/connection.js';
import { SupplyModel, SupplyType, UnitMeasure } from '../database/models/SupplyModel.js';
import { SupplyQueries } from '../database/queries/SupplyQueries.js';
import {
  CreateSupplyRequest,
  UpdateSupplyRequest,
  SupplyResponse,
  PaginatedResponse,
  SupplyListQuery,
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

    if (!data.name || !data.name.trim()) {
      throw new Error('name is required');
    }
    if (!data.unit_measure) {
      throw new Error('unit_measure is required');
    }
    if (!Object.values(UnitMeasure).includes(data.unit_measure as UnitMeasure)) {
      throw new Error(`Invalid unit_measure: ${data.unit_measure}`);
    }
    if (data.type && !Object.values(SupplyType).includes(data.type as SupplyType)) {
      throw new Error(`Invalid supply type: ${data.type}`);
    }

    const trimmedName = data.name.trim();
    const existing = await q.findSupplyByName(trimmedName, storeId);
    if (existing) {
      throw new Error('Supply with this name already exists in this store');
    }

    const supply = await q.createSupply({
      store_id: storeId,
      name: trimmedName,
      type: (data.type as SupplyType) || SupplyType.INGREDIENT,
      unit_measure: data.unit_measure as UnitMeasure,
      description: data.description,
      active: data.active !== undefined ? data.active : true,
    });

    return this.mapSupply(supply);
  }

  async getSupply(id: number, storeId: string): Promise<SupplyResponse> {
    const q = await this.ensureQueries();
    const supply = await q.findSupplyById(id, storeId);
    if (!supply) {
      throw new Error('Supply not found');
    }
    return this.mapSupply(supply);
  }

  async listSupplies(
    storeId: string,
    query: SupplyListQuery = {}
  ): Promise<PaginatedResponse<SupplyResponse>> {
    const q = await this.ensureQueries();
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Number(query.limit) || 10);
    const skip = (page - 1) * limit;

    const [supplies, total] = await q.findAllByStore(storeId, {
      type: query.type as SupplyType | undefined,
      active: query.active,
      search: query.search,
      skip,
      take: limit,
    });

    return {
      data: supplies.map((s) => this.mapSupply(s)),
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  async updateSupply(
    id: number,
    storeId: string,
    data: UpdateSupplyRequest
  ): Promise<SupplyResponse> {
    const q = await this.ensureQueries();
    const existing = await q.findSupplyById(id, storeId);
    if (!existing) {
      throw new Error('Supply not found');
    }

    if (data.name !== undefined) {
      const trimmedName = data.name.trim();
      if (!trimmedName) {
        throw new Error('name cannot be empty');
      }
      if (trimmedName !== existing.name) {
        const duplicate = await q.findSupplyByName(trimmedName, storeId);
        if (duplicate) {
          throw new Error('Supply with this name already exists in this store');
        }
      }
    }

    if (data.type && !Object.values(SupplyType).includes(data.type as SupplyType)) {
      throw new Error(`Invalid supply type: ${data.type}`);
    }

    if (data.unit_measure && !Object.values(UnitMeasure).includes(data.unit_measure as UnitMeasure)) {
      throw new Error(`Invalid unit_measure: ${data.unit_measure}`);
    }

    const updated = await q.updateSupply(
      id,
      storeId,
      {
        ...data,
        name: data.name !== undefined ? data.name.trim() : undefined,
        type: data.type as SupplyType | undefined,
        unit_measure: data.unit_measure as UnitMeasure | undefined,
        updated_at: new Date(),
      }
    );

    return this.mapSupply(updated!);
  }

  async deleteSupply(id: number, storeId: string): Promise<void> {
    const q = await this.ensureQueries();
    const existing = await q.findSupplyById(id, storeId);
    if (!existing) {
      throw new Error('Supply not found');
    }
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
