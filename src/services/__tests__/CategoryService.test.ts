import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CategoryService } from '../CategoryService.js';
import { CategoryQueries } from '../../database/queries/CategoryQueries.js';

vi.mock('../../database/connection.js', () => ({
  createDataSource: vi.fn(),
}));

describe('CategoryService', () => {
  let service: CategoryService;
  let mockQueries: any;

  const mockCategoryId = 'category-123';

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CategoryService();
    mockQueries = {
      createCategory: vi.fn(),
      findCategoryById: vi.fn(),
      findCategoryByName: vi.fn(),
      findAllCategories: vi.fn(),
      updateCategory: vi.fn(),
      deleteCategory: vi.fn(),
    } as any;
  });

  describe('createCategory', () => {
    it('should create category successfully', async () => {
      const data = { name: 'Pizza', description: 'Pizzas and pies' };
      const mockCategory = {
        id: mockCategoryId,
        ...data,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQueries.findCategoryByName.mockResolvedValue(null);
      mockQueries.createCategory.mockResolvedValue(mockCategory);
      (service as any).queries = mockQueries;

      const result = await service.createCategory(data);

      expect(result.name).toBe('Pizza');
      expect(result.description).toBe('Pizzas and pies');
      expect(result.active).toBe(true);
      expect(mockQueries.findCategoryByName).toHaveBeenCalledWith('Pizza');
      expect(mockQueries.createCategory).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Pizza',
          description: 'Pizzas and pies',
          active: true,
        })
      );
    });

    it('should throw error if category with same name exists', async () => {
      const data = { name: 'Pizza' };
      const existingCategory = { id: 'existing', name: 'Pizza' };

      mockQueries.findCategoryByName.mockResolvedValue(existingCategory);
      (service as any).queries = mockQueries;

      await expect(service.createCategory(data)).rejects.toThrow(
        'Category with this name already exists'
      );
    });
  });

  describe('getCategory', () => {
    it('should get category by id', async () => {
      const mockCategory = {
        id: mockCategoryId,
        name: 'Pizza',
        description: 'Pizzas and pies',
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQueries.findCategoryById.mockResolvedValue(mockCategory);
      (service as any).queries = mockQueries;

      const result = await service.getCategory(mockCategoryId);

      expect(result.name).toBe('Pizza');
      expect(result.id).toBe(mockCategoryId);
      expect(mockQueries.findCategoryById).toHaveBeenCalledWith(mockCategoryId);
    });

    it('should throw error if category not found', async () => {
      mockQueries.findCategoryById.mockResolvedValue(null);
      (service as any).queries = mockQueries;

      await expect(service.getCategory(mockCategoryId)).rejects.toThrow('Category not found');
    });
  });

  describe('listCategories', () => {
    it('should list categories with pagination', async () => {
      const mockCategories = [
        { id: '1', name: 'Pizza', active: true, created_at: new Date(), updated_at: new Date() },
        { id: '2', name: 'Beverage', active: true, created_at: new Date(), updated_at: new Date() },
      ];

      mockQueries.findAllCategories.mockResolvedValue([mockCategories, 2]);
      (service as any).queries = mockQueries;

      const result = await service.listCategories({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.data[0].name).toBe('Pizza');
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.total).toBe(2);
    });

    it('should calculate correct skip for pagination', async () => {
      mockQueries.findAllCategories.mockResolvedValue([[], 0]);
      (service as any).queries = mockQueries;

      await service.listCategories({ page: 3, limit: 5 });

      expect(mockQueries.findAllCategories).toHaveBeenCalledWith(false, 10, 5);
    });
  });

  describe('updateCategory', () => {
    it('should update category successfully', async () => {
      const existingCategory = { id: mockCategoryId, name: 'Pizza', active: true };
      const updateData = { name: 'Pizza Italiana', description: 'Italian pizzas' };
      const updatedCategory = {
        id: mockCategoryId,
        ...updateData,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQueries.findCategoryById.mockResolvedValue(existingCategory);
      mockQueries.findCategoryByName.mockResolvedValue(null);
      mockQueries.updateCategory.mockResolvedValue(updatedCategory);
      (service as any).queries = mockQueries;

      const result = await service.updateCategory(mockCategoryId, updateData);

      expect(result.name).toBe('Pizza Italiana');
      expect(result.description).toBe('Italian pizzas');
      expect(mockQueries.findCategoryByName).toHaveBeenCalledWith('Pizza Italiana');
    });

    it('should throw error if category not found on update', async () => {
      mockQueries.findCategoryById.mockResolvedValue(null);
      (service as any).queries = mockQueries;

      await expect(
        service.updateCategory(mockCategoryId, { name: 'Updated' })
      ).rejects.toThrow('Category not found');
    });

    it('should throw error if new name already exists', async () => {
      const existingCategory = { id: mockCategoryId, name: 'Pizza' };
      const duplicateCategory = { id: 'other-id', name: 'Pizza Italiana' };

      mockQueries.findCategoryById.mockResolvedValue(existingCategory);
      mockQueries.findCategoryByName.mockResolvedValue(duplicateCategory);
      (service as any).queries = mockQueries;

      await expect(
        service.updateCategory(mockCategoryId, { name: 'Pizza Italiana' })
      ).rejects.toThrow('Category with this name already exists');
    });
  });

  describe('deleteCategory', () => {
    it('should delete category successfully', async () => {
      const mockCategory = { id: mockCategoryId, name: 'Pizza' };

      mockQueries.findCategoryById.mockResolvedValue(mockCategory);
      mockQueries.deleteCategory.mockResolvedValue(true);
      (service as any).queries = mockQueries;

      await service.deleteCategory(mockCategoryId);

      expect(mockQueries.deleteCategory).toHaveBeenCalledWith(mockCategoryId);
    });

    it('should throw error if category not found on delete', async () => {
      mockQueries.findCategoryById.mockResolvedValue(null);
      (service as any).queries = mockQueries;

      await expect(service.deleteCategory(mockCategoryId)).rejects.toThrow(
        'Category not found'
      );
    });
  });
});
