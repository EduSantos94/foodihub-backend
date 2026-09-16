import { Repository } from 'typeorm';
import { ProductModel } from '../models/ProductModel.js';
import { ProductSizeModel } from '../models/ProductSizeModel.js';

export class ProductQueries {
  constructor(
    private productRepository: Repository<ProductModel>,
    private sizeRepository: Repository<ProductSizeModel>
  ) {}

  // ==================== Products ====================

  async createProduct(data: Partial<ProductModel>): Promise<ProductModel> {
    const product = this.productRepository.create(data);
    return this.productRepository.save(product);
  }

  async findProductById(id: string, storeId: string): Promise<ProductModel | null> {
    return this.productRepository.findOne({
      where: { id, store_id: storeId, deleted_at: undefined },
      relations: ['sizes'],
    });
  }

  async findAllByStore(
    storeId: string,
    onlyActive = false,
    skip = 0,
    take = 10
  ): Promise<[ProductModel[], number]> {
    const where: any = { store_id: storeId, deleted_at: undefined };
    if (onlyActive) where.active = true;

    return this.productRepository.findAndCount({
      where,
      relations: ['sizes'],
      order: { created_at: 'DESC' },
      skip,
      take,
    });
  }

  async updateProduct(
    id: string,
    storeId: string,
    data: Partial<ProductModel>
  ): Promise<ProductModel | null> {
    await this.productRepository.update({ id, store_id: storeId }, data);
    return this.findProductById(id, storeId);
  }

  async softDeleteProduct(id: string, storeId: string): Promise<boolean> {
    const result = await this.productRepository.update(
      { id, store_id: storeId },
      { deleted_at: new Date() }
    );
    return (result.affected || 0) > 0;
  }

  // ==================== Sizes ====================

  async createSize(data: Partial<ProductSizeModel>): Promise<ProductSizeModel> {
    const size = this.sizeRepository.create(data);
    return this.sizeRepository.save(size);
  }

  async findSizeById(id: string, storeId: string): Promise<ProductSizeModel | null> {
    return this.sizeRepository.findOne({
      where: { id, store_id: storeId },
    });
  }

  async findSizesByProduct(productId: string, storeId: string): Promise<ProductSizeModel[]> {
    return this.sizeRepository.find({
      where: { product_id: productId, store_id: storeId },
      order: { created_at: 'ASC' },
    });
  }

  async updateSize(
    id: string,
    storeId: string,
    data: Partial<ProductSizeModel>
  ): Promise<ProductSizeModel | null> {
    await this.sizeRepository.update({ id, store_id: storeId }, data);
    return this.findSizeById(id, storeId);
  }

  async deleteSize(id: string, storeId: string): Promise<boolean> {
    const result = await this.sizeRepository.delete({ id, store_id: storeId });
    return (result.affected || 0) > 0;
  }
}
