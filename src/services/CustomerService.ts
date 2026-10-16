import { Repository } from 'typeorm';
import { createDataSource } from '../database/connection.js';
import { normalizeBrazilianFields } from '../utils/brazil.js';
import { pick } from '../utils/pick.js';
import { CustomerModel } from '../database/models/CustomerModel.js';
import { CustomerQueries } from '../database/queries/CustomerQueries.js';
import { CustomerImportRow, ImportErrorCode, ImportWarningCode, prepareCustomerRow } from './customerImport.js';
import {
  CreateCustomerRequest,
  UpdateCustomerRequest,
  CustomerResponse,
  PaginatedResponse,
  PaginationQuery,
} from '../types/index.js';

export const MAX_IMPORT_ROWS = 5000;
const MAX_REPORTED_PROBLEMS = 200;

export interface CustomerImportOptions {
  /** Only report: nothing is saved */
  dry_run?: boolean;
  /** Skip a customer whose phone is already registered (default true) */
  skip_same_phone?: boolean;
}

export interface CustomerImportProblem {
  row: number;
  status: 'error' | 'duplicate' | 'warning';
  error?: ImportErrorCode;
  /** Which field matched an existing customer, for status "duplicate" */
  reason?: 'email' | 'cpf' | 'phone' | 'name';
  warnings: ImportWarningCode[];
}

export interface CustomerImportResult {
  dry_run: boolean;
  total: number;
  /** Rows imported (or that would be, on a dry run) */
  created: number;
  duplicates: number;
  errors: number;
  with_warnings: number;
  problems: CustomerImportProblem[];
  problems_truncated: boolean;
}

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
    rawData: CreateCustomerRequest
  ): Promise<CustomerResponse> {
    const q = await this.ensureQueries();
    const data = { ...rawData, ...normalizeBrazilianFields(rawData) };

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
    rawData: UpdateCustomerRequest
  ): Promise<CustomerResponse> {
    const q = await this.ensureQueries();
    const existing = await q.findCustomerById(id, storeId);
    if (!existing) throw new Error('Customer not found');
    const data = { ...rawData, ...normalizeBrazilianFields(rawData) };

    // If updating email, check for duplicates
    if (data.email && data.email !== existing.email) {
      const duplicate = await q.findCustomerByEmail(data.email, storeId);
      if (duplicate) throw new Error('Customer with this email already exists in this store');
    }

    const updated = await q.updateCustomer(id, storeId, {
      ...pick(data, ['first_name', 'last_name', 'email', 'phone', 'cpf', 'delivery_address', 'city', 'state', 'zip_code', 'notes', 'active']),
      updated_at: new Date(),
    });
    return this.mapCustomer(updated!);
  }

  /**
   * Imports customers from a spreadsheet the frontend already read and mapped. With `dry_run` it only
   * reports what would happen. A customer whose e-mail or CPF is already registered (or repeated in
   * the file) is skipped; the same goes for the phone unless `skip_same_phone` is false. A row with
   * only a name (no e-mail, CPF or phone to tell people apart) is skipped when a customer with the
   * same name exists. Bad optional
   * fields are dropped with a warning; a row without a name is an error. Valid rows are inserted in
   * one transaction.
   */
  async importCustomers(storeId: string, rows: CustomerImportRow[], options: CustomerImportOptions = {}): Promise<CustomerImportResult> {
    if (!Array.isArray(rows) || rows.length === 0) throw new Error('rows must be a non-empty list');
    if (rows.length > MAX_IMPORT_ROWS) throw new Error(`Too many rows: the limit is ${MAX_IMPORT_ROWS} per import`);

    const q = await this.ensureQueries();
    const dryRun = options.dry_run === true;
    const skipSamePhone = options.skip_same_phone !== false;

    const emails = new Set<string>();
    const cpfs = new Set<string>();
    const phones = new Set<string>();
    const names = new Set<string>();
    const nameKey = (first: string, last?: string) => `${first} ${last ?? ''}`.trim().replace(/\s+/g, ' ').toLowerCase();
    for (const existing of await q.findContactKeys(storeId)) {
      names.add(nameKey(existing.first_name, existing.last_name));
      if (existing.email) emails.add(existing.email.toLowerCase());
      if (existing.cpf) cpfs.add(existing.cpf);
      if (existing.phone) phones.add(existing.phone);
    }

    const toInsert: Partial<CustomerModel>[] = [];
    const problems: CustomerImportProblem[] = [];
    let duplicates = 0;
    let errors = 0;
    let withWarnings = 0;

    rows.forEach((raw, index) => {
      const row = Number.isInteger(raw?.row) ? (raw.row as number) : index + 1;
      const { data, warnings, error } = prepareCustomerRow(raw ?? {});

      if (!data) {
        errors++;
        problems.push({ row, status: 'error', error, warnings });
        return;
      }

      let reason: CustomerImportProblem['reason'];
      if (data.email && emails.has(data.email)) reason = 'email';
      else if (data.cpf && cpfs.has(data.cpf)) reason = 'cpf';
      else if (skipSamePhone && data.phone && phones.has(data.phone)) reason = 'phone';
      else if (!data.email && !data.cpf && !data.phone && names.has(nameKey(data.first_name, data.last_name))) reason = 'name';
      if (reason) {
        duplicates++;
        problems.push({ row, status: 'duplicate', reason, warnings });
        return;
      }

      // later rows of the same file count as duplicates of this one
      if (data.email) emails.add(data.email);
      if (data.cpf) cpfs.add(data.cpf);
      if (data.phone) phones.add(data.phone);
      names.add(nameKey(data.first_name, data.last_name));

      if (warnings.length > 0) {
        withWarnings++;
        problems.push({ row, status: 'warning', warnings });
      }
      toInsert.push(data);
    });

    if (!dryRun && toInsert.length > 0) await q.bulkCreate(storeId, toInsert);

    return {
      dry_run: dryRun,
      total: rows.length,
      created: toInsert.length,
      duplicates,
      errors,
      with_warnings: withWarnings,
      problems: problems.slice(0, MAX_REPORTED_PROBLEMS),
      problems_truncated: problems.length > MAX_REPORTED_PROBLEMS,
    };
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
