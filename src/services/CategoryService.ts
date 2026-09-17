import { Repository } from 'typeorm';
import { createDataSource } from '../database/connection.js';
import { CategoryModel } from '../database/models/CategoryModel.js';
import { CategoryQueries } from '../database/queries/CategoryQueries.js';
import {
  CreateCategoryRequest,
  UpdateCategoryRequest,
  CategoryResponse,
  PaginatedResponse,
  PaginationQuery,
} from '../types/index.js';

export class CategoryService {
  private queries?: CategoryQueries;

  private async ensureQueries(): Promise<CategoryQueries> {
    if (!this.queries) {
      const ds = await createDataSource();
      const categoryRepo: Repository<CategoryModel> = ds.getRepository(CategoryModel);
      this.queries = new CategoryQueries(categoryRepo);
    }
    return this.queries;
  }

  async createCategory(data: CreateCategoryRequest): Promise<CategoryResponse> {
    const q = await this.ensureQueries();

    // Check if category with same name already exists
    const existing = await q.findCategoryByName(data.name);
    if (existing) throw new Error('Category with this name already exists');

    const category = await q.createCategory({
      name: data.name,
      description: data.description,
      active: true,
    });
    return this.mapCategory(category);
  }

  async getCategory(id: string): Promise<CategoryResponse> {
    const q = await this.ensureQueries();
    const category = await q.findCategoryById(id);
    if (!category) throw new Error('Category not found');
    return this.mapCategory(category);
  }

  async listCategories(query: PaginationQuery): Promise<PaginatedResponse<CategoryResponse>> {
    const q = await this.ensureQueries();
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const [categories, total] = await q.findAllCategories(false, skip, limit);

    return {
      data: categories.map((c) => this.mapCategory(c)),
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    };
  }

  async updateCategory(id: string, data: UpdateCategoryRequest): Promise<CategoryResponse> {
    const q = await this.ensureQueries();
    const existing = await q.findCategoryById(id);
    if (!existing) throw new Error('Category not found');

    // If updating name, check for duplicates
    if (data.name && data.name !== existing.name) {
      const duplicate = await q.findCategoryByName(data.name);
      if (duplicate) throw new Error('Category with this name already exists');
    }

    const updated = await q.updateCategory(id, {
      ...data,
      updated_at: new Date(),
    });
    return this.mapCategory(updated!);
  }

  async deleteCategory(id: string): Promise<void> {
    const q = await this.ensureQueries();
    const existing = await q.findCategoryById(id);
    if (!existing) throw new Error('Category not found');
    await q.deleteCategory(id);
  }

  private mapCategory(c: CategoryModel): CategoryResponse {
    return {
      id: c.id,
      name: c.name,
      description: c.description,
      active: c.active,
      created_at: c.created_at,
      updated_at: c.updated_at,
    };
  }
}
