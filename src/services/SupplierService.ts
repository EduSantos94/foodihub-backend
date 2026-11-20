import { Repository } from 'typeorm';
import { cleanCnpj } from '../utils/cnpj.js';
import { bulkInsert } from '../database/queries/bulkInsert.js';
import { ImportResult, normalizeText, runImport } from './importCommon.js';
import { prepareSupplierRow, SupplierImportRow } from './supplierImport.js';
import { createDataSource } from '../database/connection.js';
import { normalizeBrazilianFields } from '../utils/brazil.js';
import { pick } from '../utils/pick.js';
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

  async createSupplier(storeId: string, rawData: CreateSupplierRequest): Promise<SupplierResponse> {
    const q = await this.ensureQueries();
    const data = { ...rawData, ...normalizeBrazilianFields(rawData) };

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
    rawData: UpdateSupplierRequest
  ): Promise<SupplierResponse> {
    const q = await this.ensureQueries();
    const existing = await q.findSupplierById(id, storeId);
    if (!existing) throw new Error('Supplier not found');
    const data = { ...rawData, ...normalizeBrazilianFields(rawData) };

    if (data.cnpj && data.cnpj !== existing.cnpj) {
      const duplicate = await q.findSupplierByCnpj(data.cnpj, storeId);
      if (duplicate) throw new Error('Supplier with this CNPJ already exists in this store');
    }

    const updated = await q.updateSupplier(id, storeId, { ...pick(data, ['name', 'cnpj', 'phone', 'email', 'contact_person', 'address', 'city', 'state', 'zip_code', 'notes', 'active']), updated_at: new Date() });
    return this.mapSupplier(updated!);
  }

  async deleteSupplier(id: string, storeId: string): Promise<void> {
    const q = await this.ensureQueries();
    const existing = await q.findSupplierById(id, storeId);
    if (!existing) throw new Error('Supplier not found');
    await q.softDeleteSupplier(id, storeId);
  }

  /**
   * Imports suppliers from a spreadsheet the frontend already read and mapped. `dry_run` only reports.
   * A supplier whose CNPJ or name is already registered (or repeated in the file) is skipped.
   */
  async importSuppliers(storeId: string, rows: SupplierImportRow[], options: { dry_run?: boolean } = {}): Promise<ImportResult> {
    const ds = await createDataSource();
    const existing = await ds.getRepository(SupplierModel).find({ where: { store_id: storeId }, select: ['name', 'cnpj'] });
    const names = new Set(existing.map((s) => normalizeText(s.name)));
    const cnpjs = new Set(existing.filter((s) => s.cnpj).map((s) => cleanCnpj(s.cnpj as string)));

    return runImport(rows, options.dry_run === true, {
      prepare: (raw) => prepareSupplierRow(raw),
      check: (data) => {
        if (data.cnpj && cnpjs.has(data.cnpj)) return 'cnpj';
        if (names.has(normalizeText(data.name))) return 'name';
        if (data.cnpj) cnpjs.add(data.cnpj);
        names.add(normalizeText(data.name));
        return undefined;
      },
      insert: (items) => bulkInsert(ds, SupplierModel, items.map((i) => ({ ...i, store_id: storeId, active: true }))),
    });
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
