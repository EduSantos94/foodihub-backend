import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CategoryController } from '../CategoryController.js';
import { CategoryService } from '../../services/CategoryService.js';

vi.mock('../../services/CategoryService.js');

describe('CategoryController', () => {
  let controller: CategoryController;
  let mockCategoryService: any;
  let mockRequest: any;
  let mockResponse: any;

  const mockCategoryId = 'category-123';

  beforeEach(() => {
    vi.clearAllMocks();

    mockCategoryService = {
      createCategory: vi.fn(),
      getCategory: vi.fn(),
      listCategories: vi.fn(),
      updateCategory: vi.fn(),
      deleteCategory: vi.fn(),
    } as any;

    controller = new CategoryController();
    (controller as any).categoryService = mockCategoryService;

    mockRequest = {
      body: {},
      params: {},
      query: {},
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
  });

  describe('createCategory', () => {
    it('should create category successfully', async () => {
      const categoryData = { name: 'Pizza', description: 'Pizzas and pies' };
      mockRequest.body = categoryData;

      const mockCategory = {
        id: mockCategoryId,
        ...categoryData,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockCategoryService.createCategory.mockResolvedValue(mockCategory);

      await controller.createCategory(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockCategory,
          message: 'Category created successfully',
        })
      );
    });

    it('should return 400 if name is missing', async () => {
      mockRequest.body = { description: 'test' };

      await controller.createCategory(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'name is required',
        })
      );
    });
  });

  describe('getCategory', () => {
    it('should get category by id', async () => {
      mockRequest.params = { id: mockCategoryId };

      const mockCategory = {
        id: mockCategoryId,
        name: 'Pizza',
        description: 'Pizzas and pies',
        active: true,
      };

      mockCategoryService.getCategory.mockResolvedValue(mockCategory);

      await controller.getCategory(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockCategory,
        })
      );
    });

    it('should return 404 if category not found', async () => {
      mockRequest.params = { id: mockCategoryId };
      mockCategoryService.getCategory.mockRejectedValue(new Error('Category not found'));

      await controller.getCategory(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });

  describe('listCategories', () => {
    it('should list categories with default pagination', async () => {
      const mockCategories = {
        data: [{ id: '1', name: 'Pizza' }],
        pagination: { page: 1, limit: 10, total: 1, total_pages: 1 },
      };

      mockCategoryService.listCategories.mockResolvedValue(mockCategories);

      await controller.listCategories(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockCategories.data,
          pagination: mockCategories.pagination,
        })
      );
    });

    it('should list categories with custom pagination', async () => {
      mockRequest.query = { page: '2', limit: '5' };

      const mockCategories = {
        data: [],
        pagination: { page: 2, limit: 5, total: 0, total_pages: 0 },
      };

      mockCategoryService.listCategories.mockResolvedValue(mockCategories);

      await controller.listCategories(mockRequest, mockResponse);

      expect(mockCategoryService.listCategories).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2, limit: 5 })
      );
    });
  });

  describe('updateCategory', () => {
    it('should update category successfully', async () => {
      mockRequest.params = { id: mockCategoryId };
      mockRequest.body = { name: 'Updated Pizza', active: true };

      const mockCategory = {
        id: mockCategoryId,
        name: 'Updated Pizza',
        active: true,
      };

      mockCategoryService.updateCategory.mockResolvedValue(mockCategory);

      await controller.updateCategory(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Category updated successfully',
        })
      );
    });

    it('should return 404 if category not found on update', async () => {
      mockRequest.params = { id: mockCategoryId };
      mockRequest.body = { name: 'Updated' };
      mockCategoryService.updateCategory.mockRejectedValue(new Error('Category not found'));

      await controller.updateCategory(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });

  describe('deleteCategory', () => {
    it('should delete category successfully', async () => {
      mockRequest.params = { id: mockCategoryId };
      mockCategoryService.deleteCategory.mockResolvedValue(undefined);

      await controller.deleteCategory(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Category deleted successfully',
        })
      );
    });

    it('should return 404 if category not found on delete', async () => {
      mockRequest.params = { id: mockCategoryId };
      mockCategoryService.deleteCategory.mockRejectedValue(new Error('Category not found'));

      await controller.deleteCategory(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });
});
