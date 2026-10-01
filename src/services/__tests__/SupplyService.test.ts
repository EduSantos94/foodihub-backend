import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupplyService } from '../SupplyService.js';

vi.mock('../../database/connection.js', () => ({ createDataSource: vi.fn() }));

describe('SupplyService', () => {
  let service: SupplyService;
  let mockQueries: any;

  const mockStoreId = 'store-123';
  const mockSupplyId = 'supply-456';

  const mockSupply = {
    id: mockSupplyId,
    store_id: mockStoreId,
    name: 'Farinha de Trigo',
    type: 'ingredient',
    unit_measure: 'kg',
    description: 'Farinha tipo 1',
    active: true,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SupplyService();
    mockQueries = {
      createSupply: vi.fn(),
      findSupplyById: vi.fn(),
      findSupplyByName: vi.fn(),
      findAllByStore: vi.fn(),
      updateSupply: vi.fn(),
      deleteSupply: vi.fn(),
    };
  });

  describe('createSupply', () => {
    it('should create supply successfully', async () => {
      mockQueries.findSupplyByName.mockResolvedValue(null);
      mockQueries.createSupply.mockResolvedValue(mockSupply);
      (service as any).queries = mockQueries;

      const result = await service.createSupply(mockStoreId, {
        name: 'Farinha de Trigo',
        unit_measure: 'kg',
        type: 'ingredient',
      });

      expect(result.name).toBe('Farinha de Trigo');
      expect(result.unit_measure).toBe('kg');
      expect(result.type).toBe('ingredient');
      expect(mockQueries.findSupplyByName).toHaveBeenCalledWith('Farinha de Trigo', mockStoreId);
    });

    it('should default type to ingredient when not provided', async () => {
      mockQueries.findSupplyByName.mockResolvedValue(null);
      mockQueries.createSupply.mockResolvedValue(mockSupply);
      (service as any).queries = mockQueries;

      await service.createSupply(mockStoreId, { name: 'Farinha', unit_measure: 'kg' });

      expect(mockQueries.createSupply).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'ingredient' })
      );
    });

    it('should throw if supply name already exists in store', async () => {
      mockQueries.findSupplyByName.mockResolvedValue(mockSupply);
      (service as any).queries = mockQueries;

      await expect(
        service.createSupply(mockStoreId, { name: 'Farinha de Trigo', unit_measure: 'kg' })
      ).rejects.toThrow('Supply with this name already exists in this store');
    });
  });

  describe('getSupply', () => {
    it('should return supply by id', async () => {
      mockQueries.findSupplyById.mockResolvedValue(mockSupply);
      (service as any).queries = mockQueries;

      const result = await service.getSupply(mockSupplyId, mockStoreId);

      expect(result.id).toBe(mockSupplyId);
      expect(result.name).toBe('Farinha de Trigo');
    });

    it('should throw if supply not found', async () => {
      mockQueries.findSupplyById.mockResolvedValue(null);
      (service as any).queries = mockQueries;

      await expect(service.getSupply(mockSupplyId, mockStoreId)).rejects.toThrow('Supply not found');
    });
  });

  describe('listSupplies', () => {
    it('should list supplies with pagination', async () => {
      mockQueries.findAllByStore.mockResolvedValue([[mockSupply], 1]);
      (service as any).queries = mockQueries;

      const result = await service.listSupplies(mockStoreId, { page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Farinha de Trigo');
      expect(result.pagination.total).toBe(1);
    });

    it('should calculate correct skip', async () => {
      mockQueries.findAllByStore.mockResolvedValue([[], 0]);
      (service as any).queries = mockQueries;

      await service.listSupplies(mockStoreId, { page: 3, limit: 5 });

      expect(mockQueries.findAllByStore).toHaveBeenCalledWith(mockStoreId, false, 10, 5);
    });
  });

  describe('updateSupply', () => {
    it('should update supply successfully', async () => {
      const updated = { ...mockSupply, unit_measure: 'g' };
      mockQueries.findSupplyById.mockResolvedValue(mockSupply);
      mockQueries.findSupplyByName.mockResolvedValue(null);
      mockQueries.updateSupply.mockResolvedValue(updated);
      (service as any).queries = mockQueries;

      const result = await service.updateSupply(mockSupplyId, mockStoreId, { unit_measure: 'g' });

      expect(result.unit_measure).toBe('g');
    });

    it('should throw if supply not found on update', async () => {
      mockQueries.findSupplyById.mockResolvedValue(null);
      (service as any).queries = mockQueries;

      await expect(
        service.updateSupply(mockSupplyId, mockStoreId, { name: 'X' })
      ).rejects.toThrow('Supply not found');
    });

    it('should throw if new name already exists', async () => {
      const duplicate = { ...mockSupply, id: 'other-id', name: 'Açúcar' };
      mockQueries.findSupplyById.mockResolvedValue(mockSupply);
      mockQueries.findSupplyByName.mockResolvedValue(duplicate);
      (service as any).queries = mockQueries;

      await expect(
        service.updateSupply(mockSupplyId, mockStoreId, { name: 'Açúcar' })
      ).rejects.toThrow('Supply with this name already exists in this store');
    });
  });

  describe('deleteSupply', () => {
    it('should delete supply successfully', async () => {
      mockQueries.findSupplyById.mockResolvedValue(mockSupply);
      mockQueries.deleteSupply.mockResolvedValue(true);
      (service as any).queries = mockQueries;

      await service.deleteSupply(mockSupplyId, mockStoreId);

      expect(mockQueries.deleteSupply).toHaveBeenCalledWith(mockSupplyId, mockStoreId);
    });

    it('should throw if supply not found on delete', async () => {
      mockQueries.findSupplyById.mockResolvedValue(null);
      (service as any).queries = mockQueries;

      await expect(service.deleteSupply(mockSupplyId, mockStoreId)).rejects.toThrow('Supply not found');
    });
  });
});
