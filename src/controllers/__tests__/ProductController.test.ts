import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProductController } from '../ProductController.js';
import { ProductService } from '../../services/ProductService.js';

vi.mock('../../services/ProductService.js');

describe('ProductController', () => {
  let controller: ProductController;
  let mockProductService: any;
  let mockRequest: any;
  let mockResponse: any;

  const mockStoreId = 'store-123';
  const mockProductId = 'product-456';
  const mockUserId = 'user-789';

  beforeEach(() => {
    vi.clearAllMocks();

    mockProductService = {
      createProduct: vi.fn(),
      getProduct: vi.fn(),
      listProducts: vi.fn(),
      updateProduct: vi.fn(),
      deleteProduct: vi.fn(),
      addSize: vi.fn(),
      listSizes: vi.fn(),
      updateSize: vi.fn(),
      deleteSize: vi.fn(),
    } as any;

    controller = new ProductController();
    (controller as any).productService = mockProductService;

    mockRequest = {
      user: { store_id: mockStoreId, user_id: mockUserId },
      body: {},
      params: {},
      query: {},
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
  });

  describe('createProduct', () => {
    it('should create product successfully', async () => {
      const productData = { name: 'Pizza', price: 25.5, description: 'Delicious', amount: 10, category_id: 'cat-1' };
      mockRequest.body = productData;

      const mockProduct = {
        id: mockProductId,
        store_id: mockStoreId,
        ...productData,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockProductService.createProduct.mockResolvedValue(mockProduct);

      await controller.createProduct(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockProduct,
          message: 'Product created successfully',
        })
      );
    });

    it('should return 400 if name is missing', async () => {
      mockRequest.body = { price: 25.5 };

      await controller.createProduct(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'name and price are required',
        })
      );
    });

    it('should return 400 if price is missing', async () => {
      mockRequest.body = { name: 'Pizza' };

      await controller.createProduct(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('should handle service errors', async () => {
      mockRequest.body = { name: 'Pizza', price: 25.5 };
      mockProductService.createProduct.mockRejectedValue(new Error('Database error'));

      await controller.createProduct(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Database error',
        })
      );
    });
  });

  describe('getProduct', () => {
    it('should get product by id', async () => {
      mockRequest.params = { id: mockProductId };

      const mockProduct = {
        id: mockProductId,
        store_id: mockStoreId,
        name: 'Pizza',
        price: 25.5,
        category_id: 'cat-1',
        active: true,
      };

      mockProductService.getProduct.mockResolvedValue(mockProduct);

      await controller.getProduct(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockProduct,
        })
      );
    });

    it('should return 404 if product not found', async () => {
      mockRequest.params = { id: mockProductId };
      mockProductService.getProduct.mockRejectedValue(new Error('Product not found'));

      await controller.getProduct(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });

  describe('listProducts', () => {
    it('should list products with default pagination', async () => {
      const mockProducts = {
        data: [{ id: '1', name: 'Pizza', price: 25.5 }],
        pagination: { page: 1, limit: 10, total: 1, total_pages: 1 },
      };

      mockProductService.listProducts.mockResolvedValue(mockProducts);

      await controller.listProducts(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockProducts.data,
          pagination: mockProducts.pagination,
        })
      );
    });

    it('should list products with custom pagination', async () => {
      mockRequest.query = { page: '2', limit: '5' };

      const mockProducts = {
        data: [],
        pagination: { page: 2, limit: 5, total: 0, total_pages: 0 },
      };

      mockProductService.listProducts.mockResolvedValue(mockProducts);

      await controller.listProducts(mockRequest, mockResponse);

      expect(mockProductService.listProducts).toHaveBeenCalledWith(
        mockStoreId,
        expect.objectContaining({ page: 2, limit: 5 })
      );
    });
  });

  describe('updateProduct', () => {
    it('should update product successfully', async () => {
      mockRequest.params = { id: mockProductId };
      mockRequest.body = { name: 'Updated Pizza', price: 30 };

      const mockProduct = { id: mockProductId, store_id: mockStoreId, ...mockRequest.body };

      mockProductService.updateProduct.mockResolvedValue(mockProduct);

      await controller.updateProduct(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Product updated successfully',
        })
      );
    });
  });

  describe('deleteProduct', () => {
    it('should delete product successfully', async () => {
      mockRequest.params = { id: mockProductId };
      mockProductService.deleteProduct.mockResolvedValue(undefined);

      await controller.deleteProduct(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Product deleted successfully',
        })
      );
    });
  });

  describe('addSize', () => {
    it('should add size successfully', async () => {
      mockRequest.params = { productId: mockProductId };
      mockRequest.body = { name: 'P' };

      const mockSize = {
        id: 'size-1',
        product_id: mockProductId,
        store_id: mockStoreId,
        name: 'P',
        active: true,
      };

      mockProductService.addSize.mockResolvedValue(mockSize);

      await controller.addSize(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Size added successfully',
        })
      );
    });

    it('should return 400 if name is missing', async () => {
      mockRequest.params = { productId: mockProductId };
      mockRequest.body = {};

      await controller.addSize(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });
  });

  describe('listSizes', () => {
    it('should list sizes for product', async () => {
      mockRequest.params = { productId: mockProductId };

      const mockSizes = [
        { id: 'size-1', name: 'P', active: true },
        { id: 'size-2', name: 'G', active: true },
      ];

      mockProductService.listSizes.mockResolvedValue(mockSizes);

      await controller.listSizes(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockSizes,
        })
      );
    });
  });

  describe('updateSize', () => {
    it('should update size successfully', async () => {
      mockRequest.params = { productId: mockProductId, sizeId: 'size-1' };
      mockRequest.body = { name: 'M' };

      const mockSize = {
        id: 'size-1',
        product_id: mockProductId,
        name: 'M',
      };

      mockProductService.updateSize.mockResolvedValue(mockSize);

      await controller.updateSize(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Size updated successfully',
        })
      );
    });
  });

  describe('deleteSize', () => {
    it('should delete size successfully', async () => {
      mockRequest.params = { productId: mockProductId, sizeId: 'size-1' };
      mockProductService.deleteSize.mockResolvedValue(undefined);

      await controller.deleteSize(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Size deleted successfully',
        })
      );
    });
  });
});
