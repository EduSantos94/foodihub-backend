import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupplierService } from '../SupplierService.js';

vi.mock('../../database/connection.js', () => ({
  createDataSource: vi.fn(),
}));

describe('SupplierService', () => {
  let service: SupplierService;
  let mockQueries: any;

  const mockStoreId = 'store-123';
  const mockSupplierId = 'supplier-456';

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SupplierService();
    mockQueries = {
      createSupplier: vi.fn(),
      findSupplierById: vi.fn(),
      findSupplierByCnpj: vi.fn(),
      findAllByStore: vi.fn(),
      updateSupplier: vi.fn(),
      softDeleteSupplier: vi.fn(),
    };
  });

  describe('createSupplier', () => {
    it('should create supplier successfully', async () => {
      const data = { name: 'Distribuidora ABC', cnpj: '12.345.678/0001-99', phone: '1133334444' };
      const mockSupplier = {
        id: mockSupplierId,
        store_id: mockStoreId,
        ...data,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQueries.findSupplierByCnpj.mockResolvedValue(null);
      mockQueries.createSupplier.mockResolvedValue(mockSupplier);
      (service as any).queries = mockQueries;

      const result = await service.createSupplier(mockStoreId, data);

      expect(result.name).toBe('Distribuidora ABC');
      expect(result.cnpj).toBe('12.345.678/0001-99');
      expect(result.active).toBe(true);
      expect(mockQueries.findSupplierByCnpj).toHaveBeenCalledWith('12.345.678/0001-99', mockStoreId);
      expect(mockQueries.createSupplier).toHaveBeenCalledWith(
        expect.objectContaining({ store_id: mockStoreId, name: 'Distribuidora ABC', active: true })
      );
    });

    it('should throw error if CNPJ already exists in this store', async () => {
      const data = { name: 'Fornecedor X', cnpj: '12.345.678/0001-99' };
      mockQueries.findSupplierByCnpj.mockResolvedValue({ id: 'existing' });
      (service as any).queries = mockQueries;

      await expect(service.createSupplier(mockStoreId, data)).rejects.toThrow(
        'Supplier with this CNPJ already exists in this store'
      );
    });

    it('should create supplier without CNPJ', async () => {
      const data = { name: 'Fornecedor Sem CNPJ' };
      const mockSupplier = {
        id: mockSupplierId,
        store_id: mockStoreId,
        name: 'Fornecedor Sem CNPJ',
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQueries.createSupplier.mockResolvedValue(mockSupplier);
      (service as any).queries = mockQueries;

      const result = await service.createSupplier(mockStoreId, data);

      expect(result.name).toBe('Fornecedor Sem CNPJ');
      expect(mockQueries.findSupplierByCnpj).not.toHaveBeenCalled();
    });
  });

  describe('getSupplier', () => {
    it('should get supplier by id', async () => {
      const mockSupplier = {
        id: mockSupplierId,
        store_id: mockStoreId,
        name: 'Fornecedor X',
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQueries.findSupplierById.mockResolvedValue(mockSupplier);
      (service as any).queries = mockQueries;

      const result = await service.getSupplier(mockSupplierId, mockStoreId);

      expect(result.id).toBe(mockSupplierId);
      expect(result.name).toBe('Fornecedor X');
      expect(mockQueries.findSupplierById).toHaveBeenCalledWith(mockSupplierId, mockStoreId);
    });

    it('should throw error if supplier not found', async () => {
      mockQueries.findSupplierById.mockResolvedValue(null);
      (service as any).queries = mockQueries;

      await expect(service.getSupplier(mockSupplierId, mockStoreId)).rejects.toThrow(
        'Supplier not found'
      );
    });
  });

  describe('listSuppliers', () => {
    it('should list suppliers with pagination', async () => {
      const mockSuppliers = [
        { id: '1', name: 'Fornecedor A', active: true, created_at: new Date(), updated_at: new Date() },
        { id: '2', name: 'Fornecedor B', active: true, created_at: new Date(), updated_at: new Date() },
      ];

      mockQueries.findAllByStore.mockResolvedValue([mockSuppliers, 2]);
      (service as any).queries = mockQueries;

      const result = await service.listSuppliers(mockStoreId, { page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.data[0].name).toBe('Fornecedor A');
      expect(result.pagination.total).toBe(2);
    });

    it('should calculate correct skip for pagination', async () => {
      mockQueries.findAllByStore.mockResolvedValue([[], 0]);
      (service as any).queries = mockQueries;

      await service.listSuppliers(mockStoreId, { page: 3, limit: 5 });

      expect(mockQueries.findAllByStore).toHaveBeenCalledWith(mockStoreId, false, 10, 5);
    });
  });

  describe('updateSupplier', () => {
    it('should update supplier successfully', async () => {
      const existing = { id: mockSupplierId, store_id: mockStoreId, name: 'Antigo', cnpj: '11.111.111/0001-11' };
      const updateData = { name: 'Novo Nome', phone: '11999999999' };
      const updated = { ...existing, ...updateData, created_at: new Date(), updated_at: new Date() };

      mockQueries.findSupplierById.mockResolvedValue(existing);
      mockQueries.findSupplierByCnpj.mockResolvedValue(null);
      mockQueries.updateSupplier.mockResolvedValue(updated);
      (service as any).queries = mockQueries;

      const result = await service.updateSupplier(mockSupplierId, mockStoreId, updateData);

      expect(result.name).toBe('Novo Nome');
      expect(result.phone).toBe('11999999999');
    });

    it('should throw error if supplier not found on update', async () => {
      mockQueries.findSupplierById.mockResolvedValue(null);
      (service as any).queries = mockQueries;

      await expect(
        service.updateSupplier(mockSupplierId, mockStoreId, { name: 'X' })
      ).rejects.toThrow('Supplier not found');
    });

    it('should throw error if new CNPJ already exists', async () => {
      const existing = { id: mockSupplierId, cnpj: '11.111.111/0001-11' };
      const duplicate = { id: 'other-id', cnpj: '22.222.222/0001-22' };

      mockQueries.findSupplierById.mockResolvedValue(existing);
      mockQueries.findSupplierByCnpj.mockResolvedValue(duplicate);
      (service as any).queries = mockQueries;

      await expect(
        service.updateSupplier(mockSupplierId, mockStoreId, { cnpj: '22.222.222/0001-22' })
      ).rejects.toThrow('Supplier with this CNPJ already exists in this store');
    });
  });

  describe('deleteSupplier', () => {
    it('should delete supplier successfully', async () => {
      const mockSupplier = { id: mockSupplierId, store_id: mockStoreId, name: 'Fornecedor X' };

      mockQueries.findSupplierById.mockResolvedValue(mockSupplier);
      mockQueries.softDeleteSupplier.mockResolvedValue(true);
      (service as any).queries = mockQueries;

      await service.deleteSupplier(mockSupplierId, mockStoreId);

      expect(mockQueries.softDeleteSupplier).toHaveBeenCalledWith(mockSupplierId, mockStoreId);
    });

    it('should throw error if supplier not found on delete', async () => {
      mockQueries.findSupplierById.mockResolvedValue(null);
      (service as any).queries = mockQueries;

      await expect(service.deleteSupplier(mockSupplierId, mockStoreId)).rejects.toThrow(
        'Supplier not found'
      );
    });
  });
});
