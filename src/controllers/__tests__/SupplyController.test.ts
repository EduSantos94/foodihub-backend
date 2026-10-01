import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupplyController } from '../SupplyController.js';
import { SupplyService } from '../../services/SupplyService.js';

vi.mock('../../services/SupplyService.js');

describe('SupplyController', () => {
  let controller: SupplyController;
  let mockSupplyService: any;
  let mockRequest: any;
  let mockResponse: any;

  const mockStoreId = 'store-123';
  const mockSupplyId = 'supply-456';

  const mockSupply = {
    id: mockSupplyId,
    store_id: mockStoreId,
    name: 'Farinha de Trigo',
    type: 'ingredient',
    unit_measure: 'kg',
    active: true,
    created_at: new Date(),
    updated_at: new Date(),
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
    (controller as any).supplyService = mockSupplyService;
    mockRequest = { user: { store_id: mockStoreId }, body: {}, params: {}, query: {} };
    mockResponse = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  });

  describe('createSupply', () => {
    it('should create supply successfully', async () => {
      mockRequest.body = { name: 'Farinha de Trigo', unit_measure: 'kg' };
      mockSupplyService.createSupply.mockResolvedValue(mockSupply);

      await controller.createSupply(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Supply created successfully' })
      );
    });

    it('should return 400 if name is missing', async () => {
      mockRequest.body = { unit_measure: 'kg' };

      await controller.createSupply(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'name and unit_measure are required' })
      );
    });

    it('should return 400 if unit_measure is missing', async () => {
      mockRequest.body = { name: 'Farinha' };

      await controller.createSupply(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 if name already exists', async () => {
      mockRequest.body = { name: 'Farinha de Trigo', unit_measure: 'kg' };
      mockSupplyService.createSupply.mockRejectedValue(
        new Error('Supply with this name already exists in this store')
      );

      await controller.createSupply(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getSupply', () => {
    it('should return supply by id', async () => {
      mockRequest.params = { id: mockSupplyId };
      mockSupplyService.getSupply.mockResolvedValue(mockSupply);

      await controller.getSupply(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: mockSupply })
      );
    });

    it('should return 404 if not found', async () => {
      mockRequest.params = { id: mockSupplyId };
      mockSupplyService.getSupply.mockRejectedValue(new Error('Supply not found'));

      await controller.getSupply(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });

  describe('listSupplies', () => {
    it('should list supplies with pagination', async () => {
      mockSupplyService.listSupplies.mockResolvedValue({
        data: [mockSupply],
        pagination: { page: 1, limit: 10, total: 1, total_pages: 1 },
      });

      await controller.listSupplies(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: [mockSupply] })
      );
    });

    it('should pass custom pagination to service', async () => {
      mockRequest.query = { page: '2', limit: '5' };
      mockSupplyService.listSupplies.mockResolvedValue({
        data: [], pagination: { page: 2, limit: 5, total: 0, total_pages: 0 },
      });

      await controller.listSupplies(mockRequest, mockResponse);

      expect(mockSupplyService.listSupplies).toHaveBeenCalledWith(
        mockStoreId, expect.objectContaining({ page: 2, limit: 5 })
      );
    });
  });

  describe('updateSupply', () => {
    it('should update supply successfully', async () => {
      mockRequest.params = { id: mockSupplyId };
      mockRequest.body = { unit_measure: 'g' };
      mockSupplyService.updateSupply.mockResolvedValue({ ...mockSupply, unit_measure: 'g' });

      await controller.updateSupply(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Supply updated successfully' })
      );
    });

    it('should return 404 if not found on update', async () => {
      mockRequest.params = { id: mockSupplyId };
      mockRequest.body = { unit_measure: 'g' };
      mockSupplyService.updateSupply.mockRejectedValue(new Error('Supply not found'));

      await controller.updateSupply(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });

  describe('deleteSupply', () => {
    it('should delete supply successfully', async () => {
      mockRequest.params = { id: mockSupplyId };
      mockSupplyService.deleteSupply.mockResolvedValue(undefined);

      await controller.deleteSupply(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Supply deleted successfully' })
      );
    });

    it('should return 404 if not found on delete', async () => {
      mockRequest.params = { id: mockSupplyId };
      mockSupplyService.deleteSupply.mockRejectedValue(new Error('Supply not found'));

      await controller.deleteSupply(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });
});
