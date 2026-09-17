import { Repository } from 'typeorm';
import { CategoryModel } from '../models/CategoryModel.js';

export class CategoryQueries {
  constructor(private categoryRepository: Repository<CategoryModel>) {}

  async createCategory(data: Partial<CategoryModel>): Promise<CategoryModel> {
    const category = this.categoryRepository.create(data);
    return this.categoryRepository.save(category);
  }

  async findCategoryById(id: string): Promise<CategoryModel | null> {
    return this.categoryRepository.findOne({
      where: { id },
    });
  }

  async findCategoryByName(name: string): Promise<CategoryModel | null> {
    return this.categoryRepository.findOne({
      where: { name },
    });
  }

  async findAllCategories(onlyActive = false, skip = 0, take = 10): Promise<[CategoryModel[], number]> {
    const where: any = {};
    if (onlyActive) where.active = true;

    return this.categoryRepository.findAndCount({
      where,
      order: { created_at: 'DESC' },
      skip,
      take,
    });
  }

  async updateCategory(id: string, data: Partial<CategoryModel>): Promise<CategoryModel | null> {
    await this.categoryRepository.update({ id }, data);
    return this.findCategoryById(id);
  }

  async deleteCategory(id: string): Promise<boolean> {
    const result = await this.categoryRepository.delete({ id });
    return (result.affected || 0) > 0;
  }
}
