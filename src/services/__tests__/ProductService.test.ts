import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProductService } from '../ProductService.js';
import { ProductQueries } from '../../database/queries/ProductQueries.js';

vi.mock('../../database/connection.js', () => ({
  createDataSource: vi.fn(),
}));

describe('ProductService', () => {
  let service: ProductService;
  let mockQueries: any;

  const mockStoreId = 'store-123';
  const mockProductId = 'product-456';

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ProductService();
    mockQueries = {
      createProduct: vi.fn(),
      findProductById: vi.fn(),
      findAllByStore: vi.fn(),
      updateProduct: vi.fn(),
      softDeleteProduct: vi.fn(),
      createSize: vi.fn(),
      findSizeById: vi.fn(),
      findSizesByProduct: vi.fn(),
      updateSize: vi.fn(),
      deleteSize: vi.fn(),
    } as any;
  });

  describe('createProduct', () => {
    it('should create a product successfully', async () => {
      const data = { name: 'Pizza', price: 25.5, description: 'Delicious pizza', amount: 10 };
      const mockProduct = {
        id: mockProductId,
        store_id: mockStoreId,
        ...data,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQueries.createProduct.mockResolvedValue(mockProduct);
      (service as any).queries = mockQueries;

      const result = await service.createProduct(mockStoreId, data);

      expect(result.name).toBe('Pizza');
      expect(result.price).toBe(25.5);
      expect(result.amount).toBe(10);
      expect(result.active).toBe(true);
      expect(mockQueries.createProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          store_id: mockStoreId,
          name: 'Pizza',
          price: 25.5,
          amount: 10,
          active: true,
        })
      );
    });

    it('should default amount to 0 when not provided', async () => {
      const data = { name: 'Pizza', price: 25.5 };
      const mockProduct = {
        id: mockProductId,
        store_id: mockStoreId,
        name: 'Pizza',
        price: 25.5,
        amount: 0,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQueries.createProduct.mockResolvedValue(mockProduct);
      (service as any).queries = mockQueries;

      const result = await service.createProduct(mockStoreId, data);
      expect(result.amount).toBe(0);
    });
  });

  describe('getProduct', () => {
    it('should get product by id', async () => {
      const mockProduct = {
        id: mockProductId,
        store_id: mockStoreId,
        name: 'Pizza',
        price: 25.5,
        amount: 5,
        active: true,
        sizes: [],
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQueries.findProductById.mockResolvedValue(mockProduct);
      (service as any).queries = mockQueries;

      const result = await service.getProduct(mockProductId, mockStoreId);

      expect(result.name).toBe('Pizza');
      expect(result.id).toBe(mockProductId);
      expect(result.amount).toBe(5);
      expect(mockQueries.findProductById).toHaveBeenCalledWith(mockProductId, mockStoreId);
    });

    it('should throw error if product not found', async () => {
      mockQueries.findProductById.mockResolvedValue(null);
      (service as any).queries = mockQueries;

      await expect(service.getProduct(mockProductId, mockStoreId)).rejects.toThrow(
        'Product not found'
      );
    });
  });

  describe('updateProduct', () => {
    it('should update product successfully', async () => {
      const updateData = { name: 'Updated Pizza', price: 30, amount: 20 };
      const mockProduct = {
        id: mockProductId,
        store_id: mockStoreId,
        name: 'Updated Pizza',
        price: 30,
        amount: 20,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQueries.findProductById.mockResolvedValue(mockProduct);
      mockQueries.updateProduct.mockResolvedValue(mockProduct);
      (service as any).queries = mockQueries;

      const result = await service.updateProduct(mockProductId, mockStoreId, updateData);

      expect(result.name).toBe('Updated Pizza');
      expect(result.price).toBe(30);
      expect(result.amount).toBe(20);
      expect(mockQueries.updateProduct).toHaveBeenCalled();
    });

    it('should throw error if product not found on update', async () => {
      mockQueries.findProductById.mockResolvedValue(null);
      (service as any).queries = mockQueries;

      await expect(
        service.updateProduct(mockProductId, mockStoreId, { name: 'New' })
      ).rejects.toThrow('Product not found');
    });
  });

  describe('deleteProduct', () => {
    it('should delete product successfully', async () => {
      const mockProduct = {
        id: mockProductId,
        store_id: mockStoreId,
        name: 'Pizza',
        active: true,
      };

      mockQueries.findProductById.mockResolvedValue(mockProduct);
      mockQueries.softDeleteProduct.mockResolvedValue(true);
      (service as any).queries = mockQueries;

      await service.deleteProduct(mockProductId, mockStoreId);

      expect(mockQueries.softDeleteProduct).toHaveBeenCalledWith(mockProductId, mockStoreId);
    });

    it('should throw error if product not found on delete', async () => {
      mockQueries.findProductById.mockResolvedValue(null);
      (service as any).queries = mockQueries;

      await expect(service.deleteProduct(mockProductId, mockStoreId)).rejects.toThrow(
        'Product not found'
      );
    });
  });

  describe('addSize', () => {
    it('should add size to product', async () => {
      const sizeData = { name: 'P' };
      const mockProduct = { id: mockProductId, store_id: mockStoreId } as any;
      const mockSize = {
        id: 'size-123',
        product_id: mockProductId,
        store_id: mockStoreId,
        name: 'P',
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQueries.findProductById.mockResolvedValue(mockProduct);
      mockQueries.createSize.mockResolvedValue(mockSize);
      (service as any).queries = mockQueries;

      const result = await service.addSize(mockProductId, mockStoreId, sizeData);

      expect(result.name).toBe('P');
      expect(mockQueries.createSize).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'P', product_id: mockProductId, store_id: mockStoreId })
      );
    });

    it('should throw error if product not found', async () => {
      mockQueries.findProductById.mockResolvedValue(null);
      (service as any).queries = mockQueries;

      await expect(
        service.addSize(mockProductId, mockStoreId, { name: 'P' })
      ).rejects.toThrow('Product not found');
    });
  });

  describe('listSizes', () => {
    it('should list sizes for product', async () => {
      const mockProduct = { id: mockProductId, store_id: mockStoreId } as any;
      const mockSizes = [
        {
          id: 'size-1',
          product_id: mockProductId,
          store_id: mockStoreId,
          name: 'P',
          active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: 'size-2',
          product_id: mockProductId,
          store_id: mockStoreId,
          name: 'G',
          active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockQueries.findProductById.mockResolvedValue(mockProduct);
      mockQueries.findSizesByProduct.mockResolvedValue(mockSizes);
      (service as any).queries = mockQueries;

      const result = await service.listSizes(mockProductId, mockStoreId);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('P');
      expect(result[1].name).toBe('G');
    });
  });

  describe('updateSize', () => {
    it('should update size successfully', async () => {
      const sizeId = 'size-1';
      const updateData = { name: 'M' };
      const mockSize = {
        id: sizeId,
        product_id: mockProductId,
        store_id: mockStoreId,
        name: 'M',
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQueries.findSizeById.mockResolvedValue(mockSize);
      mockQueries.updateSize.mockResolvedValue(mockSize);
      (service as any).queries = mockQueries;

      const result = await service.updateSize(sizeId, mockProductId, mockStoreId, updateData);

      expect(result.name).toBe('M');
      expect(mockQueries.updateSize).toHaveBeenCalled();
    });

    it('should throw error if size not found', async () => {
      mockQueries.findSizeById.mockResolvedValue(null);
      (service as any).queries = mockQueries;

      await expect(
        service.updateSize('size-1', mockProductId, mockStoreId, { name: 'M' })
      ).rejects.toThrow('Size not found');
    });
  });

  describe('deleteSize', () => {
    it('should delete size successfully', async () => {
      const sizeId = 'size-1';
      const mockSize = {
        id: sizeId,
        product_id: mockProductId,
        store_id: mockStoreId,
      };

      mockQueries.findSizeById.mockResolvedValue(mockSize);
      mockQueries.deleteSize.mockResolvedValue(true);
      (service as any).queries = mockQueries;

      await service.deleteSize(sizeId, mockProductId, mockStoreId);

      expect(mockQueries.deleteSize).toHaveBeenCalledWith(sizeId, mockStoreId);
    });
  });
});
