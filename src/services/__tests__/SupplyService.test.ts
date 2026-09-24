import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { SupplyService } from '../SupplyService.js';
import { SupplyType, UnitMeasure, SupplyModel } from '../../database/models/SupplyModel.js';
import { CreateSupplyRequest, UpdateSupplyRequest, SupplyListQuery } from '../../types/index.js';

vi.mock('../../database/connection.js', () => ({
  createDataSource: vi.fn(),
}));

interface MockSupplyQueries {
  createSupply: Mock;
  findSupplyById: Mock;
  findSupplyByName: Mock;
  findAllByStore: Mock;
  updateSupply: Mock;
  deleteSupply: Mock;
}

describe('SupplyService', () => {
  let service: SupplyService;
  let mockQueries: MockSupplyQueries;

  const mockStoreId = 'store-uuid-123';
  const mockSupplyModel: SupplyModel = {
    id: 1,
    store_id: mockStoreId,
    name: 'Farinha de Trigo',
    type: SupplyType.INGREDIENT,
    unit_measure: UnitMeasure.KG,
    description: 'Farinha especial para massas',
    active: true,
    created_at: new Date('2025-01-01T00:00:00.000Z'),
    updated_at: new Date('2025-01-01T00:00:00.000Z'),
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

    Reflect.set(service, 'queries', mockQueries);
  });

  describe('createSupply', () => {
    it('should create supply successfully', async () => {
      const createData: CreateSupplyRequest = {
        name: 'Farinha de Trigo',
        type: 'ingredient',
        unit_measure: 'kg',
        description: 'Farinha especial para massas',
        active: true,
      };

      mockQueries.findSupplyByName.mockResolvedValue(null);
      mockQueries.createSupply.mockResolvedValue(mockSupplyModel);

      const result = await service.createSupply(mockStoreId, createData);

      expect(result).toEqual({
        id: 1,
        store_id: mockStoreId,
        name: 'Farinha de Trigo',
        type: SupplyType.INGREDIENT,
        unit_measure: UnitMeasure.KG,
        description: 'Farinha especial para massas',
        active: true,
        created_at: mockSupplyModel.created_at,
        updated_at: mockSupplyModel.updated_at,
      });

      expect(mockQueries.findSupplyByName).toHaveBeenCalledWith('Farinha de Trigo', mockStoreId);
      expect(mockQueries.createSupply).toHaveBeenCalledWith({
        store_id: mockStoreId,
        name: 'Farinha de Trigo',
        type: SupplyType.INGREDIENT,
        unit_measure: UnitMeasure.KG,
        description: 'Farinha especial para massas',
        active: true,
      });
    });

    it('should throw error if name is missing or empty', async () => {
      const invalidData = {
        name: '   ',
        unit_measure: 'kg',
      } as unknown as CreateSupplyRequest;

      await expect(service.createSupply(mockStoreId, invalidData)).rejects.toThrow('name is required');
      expect(mockQueries.createSupply).not.toHaveBeenCalled();
    });

    it('should throw error if unit_measure is missing', async () => {
      const invalidData = {
        name: 'Farinha',
      } as unknown as CreateSupplyRequest;

      await expect(service.createSupply(mockStoreId, invalidData)).rejects.toThrow('unit_measure is required');
      expect(mockQueries.createSupply).not.toHaveBeenCalled();
    });

    it('should throw error if unit_measure is invalid', async () => {
      const invalidData = {
        name: 'Farinha',
        unit_measure: 'invalid_unit',
      } as unknown as CreateSupplyRequest;

      await expect(service.createSupply(mockStoreId, invalidData)).rejects.toThrow('Invalid unit_measure: invalid_unit');
      expect(mockQueries.createSupply).not.toHaveBeenCalled();
    });

    it('should throw error if type is invalid', async () => {
      const invalidData = {
        name: 'Farinha',
        unit_measure: 'kg',
        type: 'invalid_type',
      } as unknown as CreateSupplyRequest;

      await expect(service.createSupply(mockStoreId, invalidData)).rejects.toThrow('Invalid supply type: invalid_type');
      expect(mockQueries.createSupply).not.toHaveBeenCalled();
    });

    it('should throw error if supply with same name already exists in store', async () => {
      const createData: CreateSupplyRequest = {
        name: 'Farinha de Trigo',
        unit_measure: 'kg',
      };

      mockQueries.findSupplyByName.mockResolvedValue(mockSupplyModel);

      await expect(service.createSupply(mockStoreId, createData)).rejects.toThrow(
        'Supply with this name already exists in this store'
      );
      expect(mockQueries.createSupply).not.toHaveBeenCalled();
    });
  });

  describe('getSupply', () => {
    it('should get supply by id', async () => {
      mockQueries.findSupplyById.mockResolvedValue(mockSupplyModel);

      const result = await service.getSupply(1, mockStoreId);

      expect(result.id).toBe(1);
      expect(result.name).toBe('Farinha de Trigo');
      expect(mockQueries.findSupplyById).toHaveBeenCalledWith(1, mockStoreId);
    });

    it('should throw error if supply not found', async () => {
      mockQueries.findSupplyById.mockResolvedValue(null);

      await expect(service.getSupply(999, mockStoreId)).rejects.toThrow('Supply not found');
    });
  });

  describe('listSupplies', () => {
    it('should list supplies with default pagination', async () => {
      mockQueries.findAllByStore.mockResolvedValue([[mockSupplyModel], 1]);

      const result = await service.listSupplies(mockStoreId);

      expect(result.data).toHaveLength(1);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        total_pages: 1,
      });
      expect(mockQueries.findAllByStore).toHaveBeenCalledWith(mockStoreId, {
        type: undefined,
        active: undefined,
        search: undefined,
        skip: 0,
        take: 10,
      });
    });

    it('should list supplies with custom query and calculate skip', async () => {
      mockQueries.findAllByStore.mockResolvedValue([[mockSupplyModel], 15]);

      const query: SupplyListQuery = {
        page: 2,
        limit: 5,
        type: 'ingredient',
        active: true,
        search: 'Farinha',
      };

      const result = await service.listSupplies(mockStoreId, query);

      expect(result.pagination).toEqual({
        page: 2,
        limit: 5,
        total: 15,
        total_pages: 3,
      });
      expect(mockQueries.findAllByStore).toHaveBeenCalledWith(mockStoreId, {
        type: SupplyType.INGREDIENT,
        active: true,
        search: 'Farinha',
        skip: 5,
        take: 5,
      });
    });
  });

  describe('updateSupply', () => {
    it('should update supply successfully', async () => {
      const updatedModel: SupplyModel = {
        ...mockSupplyModel,
        name: 'Farinha Integral',
        unit_measure: UnitMeasure.G,
        type: SupplyType.INGREDIENT,
      };

      mockQueries.findSupplyById.mockResolvedValue(mockSupplyModel);
      mockQueries.findSupplyByName.mockResolvedValue(null);
      mockQueries.updateSupply.mockResolvedValue(updatedModel);

      const updateData: UpdateSupplyRequest = {
        name: 'Farinha Integral',
        unit_measure: 'g',
      };

      const result = await service.updateSupply(1, mockStoreId, updateData);

      expect(result.name).toBe('Farinha Integral');
      expect(result.unit_measure).toBe(UnitMeasure.G);
      expect(mockQueries.updateSupply).toHaveBeenCalledWith(
        1,
        mockStoreId,
        expect.objectContaining({
          name: 'Farinha Integral',
          unit_measure: UnitMeasure.G,
        })
      );
    });

    it('should throw error if supply to update not found', async () => {
      mockQueries.findSupplyById.mockResolvedValue(null);

      await expect(
        service.updateSupply(999, mockStoreId, { name: 'Farinha Integral' })
      ).rejects.toThrow('Supply not found');

      expect(mockQueries.updateSupply).not.toHaveBeenCalled();
    });

    it('should throw error if updated name is empty', async () => {
      mockQueries.findSupplyById.mockResolvedValue(mockSupplyModel);

      await expect(
        service.updateSupply(1, mockStoreId, { name: '   ' })
      ).rejects.toThrow('name cannot be empty');

      expect(mockQueries.updateSupply).not.toHaveBeenCalled();
    });

    it('should throw error if updated name collides with another supply', async () => {
      mockQueries.findSupplyById.mockResolvedValue(mockSupplyModel);
      mockQueries.findSupplyByName.mockResolvedValue({
        id: 2,
        name: 'Outra Farinha',
      } as SupplyModel);

      await expect(
        service.updateSupply(1, mockStoreId, { name: 'Outra Farinha' })
      ).rejects.toThrow('Supply with this name already exists in this store');

      expect(mockQueries.updateSupply).not.toHaveBeenCalled();
    });

    it('should throw error if updated type is invalid', async () => {
      mockQueries.findSupplyById.mockResolvedValue(mockSupplyModel);

      const updateData = {
        type: 'invalid_type',
      } as unknown as UpdateSupplyRequest;

      await expect(service.updateSupply(1, mockStoreId, updateData)).rejects.toThrow(
        'Invalid supply type: invalid_type'
      );
    });

    it('should throw error if updated unit_measure is invalid', async () => {
      mockQueries.findSupplyById.mockResolvedValue(mockSupplyModel);

      const updateData = {
        unit_measure: 'invalid_unit',
      } as unknown as UpdateSupplyRequest;

      await expect(service.updateSupply(1, mockStoreId, updateData)).rejects.toThrow(
        'Invalid unit_measure: invalid_unit'
      );
    });
  });

  describe('deleteSupply', () => {
    it('should delete supply successfully', async () => {
      mockQueries.findSupplyById.mockResolvedValue(mockSupplyModel);
      mockQueries.deleteSupply.mockResolvedValue(true);

      await service.deleteSupply(1, mockStoreId);

      expect(mockQueries.deleteSupply).toHaveBeenCalledWith(1, mockStoreId);
    });

    it('should throw error if supply to delete not found', async () => {
      mockQueries.findSupplyById.mockResolvedValue(null);

      await expect(service.deleteSupply(999, mockStoreId)).rejects.toThrow('Supply not found');
      expect(mockQueries.deleteSupply).not.toHaveBeenCalled();
    });
  });
});
