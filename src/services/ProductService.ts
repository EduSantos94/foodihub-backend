import { Repository } from 'typeorm';
import { createDataSource } from '../database/connection.js';
import { pick } from '../utils/pick.js';
import { ProductModel } from '../database/models/ProductModel.js';
import { ProductSizeModel } from '../database/models/ProductSizeModel.js';
import { ProductQueries } from '../database/queries/ProductQueries.js';
import {
  CreateProductRequest,
  UpdateProductRequest,
  ProductResponse,
  ProductSizeResponse,
  CreateProductSizeRequest,
  UpdateProductSizeRequest,
  PaginatedResponse,
  PaginationQuery,
} from '../types/index.js';

export class ProductService {
  private queries?: ProductQueries;

  private async ensureQueries(): Promise<ProductQueries> {
    if (!this.queries) {
      const ds = await createDataSource();
      const productRepo: Repository<ProductModel> = ds.getRepository(ProductModel);
      const sizeRepo: Repository<ProductSizeModel> = ds.getRepository(ProductSizeModel);
      this.queries = new ProductQueries(productRepo, sizeRepo);
    }
    return this.queries;
  }

  // ==================== Products ====================

  async createProduct(
    storeId: string,
    data: CreateProductRequest
  ): Promise<ProductResponse> {
    const q = await this.ensureQueries();
    if (data.category_id) await this.assertCategoryAvailable(q, data.category_id);

    const product = await q.createProduct({
      store_id: storeId,
      name: data.name,
      description: data.description,
      price: data.price,
      amount: data.amount ?? 0,
      category_id: data.category_id,
      active: true,
    });
    return this.mapProduct(product);
  }

  async getProduct(id: string, storeId: string): Promise<ProductResponse> {
    const q = await this.ensureQueries();
    const product = await q.findProductById(id, storeId);
    if (!product) throw new Error('Product not found');
    return this.mapProduct(product);
  }

  async listProducts(
    storeId: string,
    query: PaginationQuery
  ): Promise<PaginatedResponse<ProductResponse>> {
    const q = await this.ensureQueries();
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const [products, total] = await q.findAllByStore(storeId, false, skip, limit);

    return {
      data: products.map((p) => this.mapProduct(p)),
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    };
  }

  async updateProduct(
    id: string,
    storeId: string,
    data: UpdateProductRequest
  ): Promise<ProductResponse> {
    const q = await this.ensureQueries();
    const existing = await q.findProductById(id, storeId);
    if (!existing) throw new Error('Product not found');

    // Only the documented fields are accepted (never store_id, deleted_at, ...)
    const changes: Partial<ProductModel> = { updated_at: new Date() };
    if (data.name !== undefined) changes.name = data.name;
    if (data.description !== undefined) changes.description = data.description;
    if (data.price !== undefined) changes.price = data.price;
    if (data.amount !== undefined) changes.amount = data.amount;
    if (data.active !== undefined) changes.active = data.active;
    if (data.category_id !== undefined) {
      // Moving to another category must pick an existing active one; the current one can stay
      if (data.category_id && data.category_id !== existing.category_id) {
        await this.assertCategoryAvailable(q, data.category_id);
      }
      changes.category_id = data.category_id;
    }

    const updated = await q.updateProduct(id, storeId, changes);
    return this.mapProduct(updated!);
  }

  /** Stores only select categories that the platform already created and kept active. */
  private async assertCategoryAvailable(q: ProductQueries, categoryId: string): Promise<void> {
    const category = await q.findCategoryById(categoryId);
    if (!category) throw new Error('Category not found');
    if (!category.active) throw new Error('Category is inactive');
  }

  async deleteProduct(id: string, storeId: string): Promise<void> {
    const q = await this.ensureQueries();
    const existing = await q.findProductById(id, storeId);
    if (!existing) throw new Error('Product not found');
    await q.softDeleteProduct(id, storeId);
  }

  // ==================== Sizes ====================

  async addSize(
    productId: string,
    storeId: string,
    data: CreateProductSizeRequest
  ): Promise<ProductSizeResponse> {
    const q = await this.ensureQueries();
    const product = await q.findProductById(productId, storeId);
    if (!product) throw new Error('Product not found');

    const size = await q.createSize({
      product_id: productId,
      store_id: storeId,
      name: data.name,
      active: true,
    });
    return this.mapSize(size);
  }

  async listSizes(productId: string, storeId: string): Promise<ProductSizeResponse[]> {
    const q = await this.ensureQueries();
    const product = await q.findProductById(productId, storeId);
    if (!product) throw new Error('Product not found');

    const sizes = await q.findSizesByProduct(productId, storeId);
    return sizes.map((s) => this.mapSize(s));
  }

  async updateSize(
    sizeId: string,
    productId: string,
    storeId: string,
    data: UpdateProductSizeRequest
  ): Promise<ProductSizeResponse> {
    const q = await this.ensureQueries();
    const size = await q.findSizeById(sizeId, storeId);
    if (!size || size.product_id !== productId) throw new Error('Size not found');

    const updated = await q.updateSize(sizeId, storeId, { ...pick(data, ['name', 'active']), updated_at: new Date() });
    return this.mapSize(updated!);
  }

  async deleteSize(sizeId: string, productId: string, storeId: string): Promise<void> {
    const q = await this.ensureQueries();
    const size = await q.findSizeById(sizeId, storeId);
    if (!size || size.product_id !== productId) throw new Error('Size not found');
    await q.deleteSize(sizeId, storeId);
  }

  // ==================== Mappers ====================

  private mapProduct(p: ProductModel): ProductResponse {
    return {
      id: p.id,
      store_id: p.store_id,
      category_id: p.category_id,
      name: p.name,
      description: p.description,
      price: Number(p.price),
      amount: Number(p.amount ?? 0),
      active: p.active,
      sizes: (p.sizes as ProductSizeModel[] | undefined)?.map((s) => this.mapSize(s)),
      created_at: p.created_at,
      updated_at: p.updated_at,
    };
  }

  private mapSize(s: ProductSizeModel): ProductSizeResponse {
    return {
      id: s.id,
      product_id: s.product_id,
      store_id: s.store_id,
      name: s.name,
      active: s.active,
      created_at: s.created_at,
      updated_at: s.updated_at,
    };
  }
}
