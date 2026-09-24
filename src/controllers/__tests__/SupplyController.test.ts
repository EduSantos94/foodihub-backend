import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { Request, Response } from 'express';
import { SupplyController } from '../SupplyController.js';
import { SupplyService } from '../../services/SupplyService.js';
import { SupplyType, UnitMeasure } from '../../database/models/SupplyModel.js';
import { SupplyResponse, PaginatedResponse } from '../../types/index.js';

vi.mock('../../services/SupplyService.js');

interface MockResponse extends Partial<Response> {
  statusCode?: number;
  jsonData?: unknown;
  status: (code: number) => MockResponse;
  json: (data: unknown) => MockResponse;
}

function createMockResponse(): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    jsonData: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: unknown) {
      this.jsonData = data;
      return this;
    },
  };
  return res;
}

describe('SupplyController', () => {
  let controller: SupplyController;
  let mockSupplyService: {
    createSupply: Mock;
    getSupply: Mock;
    listSupplies: Mock;
    updateSupply: Mock;
    deleteSupply: Mock;
  };
  let mockRequest: Partial<Request>;
  let mockResponse: MockResponse;

  const mockStoreId = 'store-uuid-123';
  const mockSupplyResponse: SupplyResponse = {
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

    mockSupplyService = {
      createSupply: vi.fn(),
      getSupply: vi.fn(),
      listSupplies: vi.fn(),
      updateSupply: vi.fn(),
      deleteSupply: vi.fn(),
    };

    controller = new SupplyController();
    Reflect.set(controller, 'supplyService', mockSupplyService);

    mockRequest = {
      body: {},
      params: {},
      query: {},
      headers: {},
    };
    Reflect.set(mockRequest, 'user', { store_id: mockStoreId });

    mockResponse = createMockResponse();
  });

  describe('createSupply', () => {
    it('should create supply successfully and return 201', async () => {
      mockRequest.body = {
        name: 'Farinha de Trigo',
        type: 'ingredient',
        unit_measure: 'kg',
        description: 'Farinha especial para massas',
      };

      mockSupplyService.createSupply.mockResolvedValue(mockSupplyResponse);

      await controller.createSupply(mockRequest as Request, mockResponse as unknown as Response);

      expect(mockResponse.statusCode).toBe(201);
      expect(mockResponse.jsonData).toEqual({
        success: true,
        data: mockSupplyResponse,
        message: 'Supply created successfully',
      });
      expect(mockSupplyService.createSupply).toHaveBeenCalledWith(mockStoreId, mockRequest.body);
    });

    it('should return 400 if store_id is missing', async () => {
      Reflect.set(mockRequest, 'user', undefined);
      mockRequest.headers = {};
      mockRequest.query = {};
      mockRequest.body = { name: 'Farinha', unit_measure: 'kg' };

      await controller.createSupply(mockRequest as Request, mockResponse as unknown as Response);

      expect(mockResponse.statusCode).toBe(400);
      expect((mockResponse.jsonData as { error: string }).error).toBe('store_id is required');
      expect(mockSupplyService.createSupply).not.toHaveBeenCalled();
    });

    it('should return 400 if name is missing', async () => {
      mockRequest.body = { unit_measure: 'kg' };

      await controller.createSupply(mockRequest as Request, mockResponse as unknown as Response);

      expect(mockResponse.statusCode).toBe(400);
      expect((mockResponse.jsonData as { error: string }).error).toBe('name is required');
      expect(mockSupplyService.createSupply).not.toHaveBeenCalled();
    });

    it('should return 400 if unit_measure is missing', async () => {
      mockRequest.body = { name: 'Farinha' };

      await controller.createSupply(mockRequest as Request, mockResponse as unknown as Response);

      expect(mockResponse.statusCode).toBe(400);
      expect((mockResponse.jsonData as { error: string }).error).toBe('unit_measure is required');
      expect(mockSupplyService.createSupply).not.toHaveBeenCalled();
    });

    it('should return 400 if supply with same name exists', async () => {
      mockRequest.body = { name: 'Farinha de Trigo', unit_measure: 'kg' };
      mockSupplyService.createSupply.mockRejectedValue(
        new Error('Supply with this name already exists in this store')
      );

      await controller.createSupply(mockRequest as Request, mockResponse as unknown as Response);

      expect(mockResponse.statusCode).toBe(400);
      expect((mockResponse.jsonData as { error: string }).error).toBe(
        'Supply with this name already exists in this store'
      );
    });
  });

  describe('getSupply', () => {
    it('should get supply by id and return 200', async () => {
      mockRequest.params = { id: '1' };
      mockSupplyService.getSupply.mockResolvedValue(mockSupplyResponse);

      await controller.getSupply(mockRequest as Request, mockResponse as unknown as Response);

      expect(mockResponse.statusCode).toBe(200);
      expect(mockResponse.jsonData).toEqual({
        success: true,
        data: mockSupplyResponse,
      });
      expect(mockSupplyService.getSupply).toHaveBeenCalledWith(1, mockStoreId);
    });

    it('should return 400 if id is not a number', async () => {
      mockRequest.params = { id: 'invalid' };

      await controller.getSupply(mockRequest as Request, mockResponse as unknown as Response);

      expect(mockResponse.statusCode).toBe(400);
      expect((mockResponse.jsonData as { error: string }).error).toBe('Invalid supply ID');
      expect(mockSupplyService.getSupply).not.toHaveBeenCalled();
    });

    it('should return 404 if supply is not found', async () => {
      mockRequest.params = { id: '999' };
      mockSupplyService.getSupply.mockRejectedValue(new Error('Supply not found'));

      await controller.getSupply(mockRequest as Request, mockResponse as unknown as Response);

      expect(mockResponse.statusCode).toBe(404);
      expect((mockResponse.jsonData as { error: string }).error).toBe('Supply not found');
    });

    it('should return 400 if store_id is missing on getSupply', async () => {
      Reflect.set(mockRequest, 'user', undefined);
      mockRequest.params = { id: '1' };

      await controller.getSupply(mockRequest as Request, mockResponse as unknown as Response);

      expect(mockResponse.statusCode).toBe(400);
      expect((mockResponse.jsonData as { error: string }).error).toBe('store_id is required');
    });
  });

  describe('listSupplies', () => {
    it('should list supplies with pagination', async () => {
      const paginatedResult: PaginatedResponse<SupplyResponse> = {
        data: [mockSupplyResponse],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          total_pages: 1,
        },
      };

      mockRequest.query = {};
      mockSupplyService.listSupplies.mockResolvedValue(paginatedResult);

      await controller.listSupplies(mockRequest as Request, mockResponse as unknown as Response);

      expect(mockResponse.statusCode).toBe(200);
      expect(mockResponse.jsonData).toEqual({
        success: true,
        data: paginatedResult.data,
        pagination: paginatedResult.pagination,
      });
      expect(mockSupplyService.listSupplies).toHaveBeenCalledWith(mockStoreId, {
        page: 1,
        limit: 10,
        type: undefined,
        active: undefined,
        search: undefined,
      });
    });

    it('should parse filters and custom pagination', async () => {
      const paginatedResult: PaginatedResponse<SupplyResponse> = {
        data: [mockSupplyResponse],
        pagination: {
          page: 2,
          limit: 5,
          total: 8,
          total_pages: 2,
        },
      };

      mockRequest.query = {
        page: '2',
        limit: '5',
        type: 'ingredient',
        active: 'true',
        search: 'Farinha',
      };
      mockSupplyService.listSupplies.mockResolvedValue(paginatedResult);

      await controller.listSupplies(mockRequest as Request, mockResponse as unknown as Response);

      expect(mockResponse.statusCode).toBe(200);
      expect(mockSupplyService.listSupplies).toHaveBeenCalledWith(mockStoreId, {
        page: 2,
        limit: 5,
        type: 'ingredient',
        active: true,
        search: 'Farinha',
      });
    });

    it('should return 400 if store_id is missing on listSupplies', async () => {
      Reflect.set(mockRequest, 'user', undefined);

      await controller.listSupplies(mockRequest as Request, mockResponse as unknown as Response);

      expect(mockResponse.statusCode).toBe(400);
      expect((mockResponse.jsonData as { error: string }).error).toBe('store_id is required');
    });
  });

  describe('updateSupply', () => {
    it('should update supply successfully', async () => {
      const updatedResponse: SupplyResponse = {
        ...mockSupplyResponse,
        name: 'Farinha Integral',
      };

      mockRequest.params = { id: '1' };
      mockRequest.body = { name: 'Farinha Integral' };
      mockSupplyService.updateSupply.mockResolvedValue(updatedResponse);

      await controller.updateSupply(mockRequest as Request, mockResponse as unknown as Response);

      expect(mockResponse.statusCode).toBe(200);
      expect(mockResponse.jsonData).toEqual({
        success: true,
        data: updatedResponse,
        message: 'Supply updated successfully',
      });
      expect(mockSupplyService.updateSupply).toHaveBeenCalledWith(1, mockStoreId, mockRequest.body);
    });

    it('should return 400 if id is invalid on update', async () => {
      mockRequest.params = { id: 'invalid' };
      mockRequest.body = { name: 'Farinha Integral' };

      await controller.updateSupply(mockRequest as Request, mockResponse as unknown as Response);

      expect(mockResponse.statusCode).toBe(400);
      expect((mockResponse.jsonData as { error: string }).error).toBe('Invalid supply ID');
      expect(mockSupplyService.updateSupply).not.toHaveBeenCalled();
    });

    it('should return 404 if supply to update is not found', async () => {
      mockRequest.params = { id: '999' };
      mockRequest.body = { name: 'Farinha Integral' };
      mockSupplyService.updateSupply.mockRejectedValue(new Error('Supply not found'));

      await controller.updateSupply(mockRequest as Request, mockResponse as unknown as Response);

      expect(mockResponse.statusCode).toBe(404);
      expect((mockResponse.jsonData as { error: string }).error).toBe('Supply not found');
    });
  });

  describe('deleteSupply', () => {
    it('should delete supply successfully', async () => {
      mockRequest.params = { id: '1' };
      mockSupplyService.deleteSupply.mockResolvedValue(undefined);

      await controller.deleteSupply(mockRequest as Request, mockResponse as unknown as Response);

      expect(mockResponse.statusCode).toBe(200);
      expect(mockResponse.jsonData).toEqual({
        success: true,
        message: 'Supply deleted successfully',
      });
      expect(mockSupplyService.deleteSupply).toHaveBeenCalledWith(1, mockStoreId);
    });

    it('should return 400 if id is invalid on delete', async () => {
      mockRequest.params = { id: 'invalid' };

      await controller.deleteSupply(mockRequest as Request, mockResponse as unknown as Response);

      expect(mockResponse.statusCode).toBe(400);
      expect((mockResponse.jsonData as { error: string }).error).toBe('Invalid supply ID');
      expect(mockSupplyService.deleteSupply).not.toHaveBeenCalled();
    });

    it('should return 404 if supply to delete is not found', async () => {
      mockRequest.params = { id: '999' };
      mockSupplyService.deleteSupply.mockRejectedValue(new Error('Supply not found'));

      await controller.deleteSupply(mockRequest as Request, mockResponse as unknown as Response);

      expect(mockResponse.statusCode).toBe(404);
      expect((mockResponse.jsonData as { error: string }).error).toBe('Supply not found');
    });
  });
});
