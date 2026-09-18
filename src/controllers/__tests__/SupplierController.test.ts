import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupplierController } from '../SupplierController.js';
import { SupplierService } from '../../services/SupplierService.js';

vi.mock('../../services/SupplierService.js');

describe('SupplierController', () => {
  let controller: SupplierController;
  let mockSupplierService: any;
  let mockRequest: any;
  let mockResponse: any;

  const mockStoreId = 'store-123';
  const mockSupplierId = 'supplier-456';

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupplierService = {
      createSupplier: vi.fn(),
      getSupplier: vi.fn(),
      listSuppliers: vi.fn(),
      updateSupplier: vi.fn(),
      deleteSupplier: vi.fn(),
    };

    controller = new SupplierController();
    (controller as any).supplierService = mockSupplierService;

    mockRequest = {
      user: { store_id: mockStoreId },
      body: {},
      params: {},
      query: {},
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
  });

  describe('createSupplier', () => {
    it('should create supplier successfully', async () => {
      const data = { name: 'Distribuidora ABC', cnpj: '12.345.678/0001-99', phone: '1133334444' };
      mockRequest.body = data;

      const mockSupplier = {
        id: mockSupplierId,
        store_id: mockStoreId,
        ...data,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockSupplierService.createSupplier.mockResolvedValue(mockSupplier);

      await controller.createSupplier(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockSupplier,
          message: 'Supplier created successfully',
        })
      );
    });

    it('should return 400 if name is missing', async () => {
      mockRequest.body = { cnpj: '12.345.678/0001-99' };

      await controller.createSupplier(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: 'name is required' })
      );
    });

    it('should return 400 if CNPJ already exists', async () => {
      mockRequest.body = { name: 'Fornecedor X', cnpj: '12.345.678/0001-99' };
      mockSupplierService.createSupplier.mockRejectedValue(
        new Error('Supplier with this CNPJ already exists in this store')
      );

      await controller.createSupplier(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getSupplier', () => {
    it('should get supplier by id', async () => {
      mockRequest.params = { id: mockSupplierId };

      const mockSupplier = { id: mockSupplierId, store_id: mockStoreId, name: 'Fornecedor X' };
      mockSupplierService.getSupplier.mockResolvedValue(mockSupplier);

      await controller.getSupplier(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: mockSupplier })
      );
    });

    it('should return 404 if supplier not found', async () => {
      mockRequest.params = { id: mockSupplierId };
      mockSupplierService.getSupplier.mockRejectedValue(new Error('Supplier not found'));

      await controller.getSupplier(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });

  describe('listSuppliers', () => {
    it('should list suppliers with default pagination', async () => {
      const mockResult = {
        data: [{ id: '1', name: 'Fornecedor A' }],
        pagination: { page: 1, limit: 10, total: 1, total_pages: 1 },
      };

      mockSupplierService.listSuppliers.mockResolvedValue(mockResult);

      await controller.listSuppliers(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockResult.data,
          pagination: mockResult.pagination,
        })
      );
    });

    it('should pass custom pagination to service', async () => {
      mockRequest.query = { page: '2', limit: '5' };
      mockSupplierService.listSuppliers.mockResolvedValue({
        data: [],
        pagination: { page: 2, limit: 5, total: 0, total_pages: 0 },
      });

      await controller.listSuppliers(mockRequest, mockResponse);

      expect(mockSupplierService.listSuppliers).toHaveBeenCalledWith(
        mockStoreId,
        expect.objectContaining({ page: 2, limit: 5 })
      );
    });
  });

  describe('updateSupplier', () => {
    it('should update supplier successfully', async () => {
      mockRequest.params = { id: mockSupplierId };
      mockRequest.body = { name: 'Fornecedor Atualizado', phone: '1199998888' };

      const mockSupplier = { id: mockSupplierId, name: 'Fornecedor Atualizado' };
      mockSupplierService.updateSupplier.mockResolvedValue(mockSupplier);

      await controller.updateSupplier(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Supplier updated successfully' })
      );
    });

    it('should return 404 if supplier not found on update', async () => {
      mockRequest.params = { id: mockSupplierId };
      mockRequest.body = { name: 'X' };
      mockSupplierService.updateSupplier.mockRejectedValue(new Error('Supplier not found'));

      await controller.updateSupplier(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });

  describe('deleteSupplier', () => {
    it('should delete supplier successfully', async () => {
      mockRequest.params = { id: mockSupplierId };
      mockSupplierService.deleteSupplier.mockResolvedValue(undefined);

      await controller.deleteSupplier(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Supplier deleted successfully' })
      );
    });

    it('should return 404 if supplier not found on delete', async () => {
      mockRequest.params = { id: mockSupplierId };
      mockSupplierService.deleteSupplier.mockRejectedValue(new Error('Supplier not found'));

      await controller.deleteSupplier(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });
});
