import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PurchaseController } from '../PurchaseController.js';
import { PurchaseService } from '../../services/PurchaseService.js';

vi.mock('../../services/PurchaseService.js');

describe('PurchaseController', () => {
  let controller: PurchaseController;
  let mockPurchaseService: any;
  let mockRequest: any;
  let mockResponse: any;

  const mockStoreId = 'store-123';
  const mockPurchaseId = 'purchase-456';

  const mockPurchase = {
    id: mockPurchaseId,
    store_id: mockStoreId,
    supplier_id: 'supplier-789',
    purchase_date: new Date('2026-01-15'),
    total_amount: 55,
    paid_amount: 0,
    payment_status: 'pending',
    items: [{ id: 'item-1', supply_id: 'supply-1', quantity: 10, unit_price: 5.5, total_price: 55 }],
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPurchaseService = {
      createPurchase: vi.fn(),
      getPurchase: vi.fn(),
      listPurchases: vi.fn(),
      updatePurchase: vi.fn(),
      deletePurchase: vi.fn(),
    };
    controller = new PurchaseController();
    (controller as any).purchaseService = mockPurchaseService;
    mockRequest = { user: { store_id: mockStoreId }, body: {}, params: {}, query: {} };
    mockResponse = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  });

  describe('createPurchase', () => {
    it('should create purchase successfully', async () => {
      mockRequest.body = {
        supplier_id: 'supplier-789',
        purchase_date: '2026-01-15',
        items: [{ supply_id: 'supply-1', quantity: 10, unit_price: 5.5 }],
      };
      mockPurchaseService.createPurchase.mockResolvedValue(mockPurchase);

      await controller.createPurchase(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Purchase created successfully' })
      );
    });

    it('should return 400 if supplier_id is missing', async () => {
      mockRequest.body = {
        purchase_date: '2026-01-15',
        items: [{ supply_id: 'supply-1', quantity: 10, unit_price: 5.5 }],
      };

      await controller.createPurchase(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'supplier_id and purchase_date are required' })
      );
    });

    it('should return 400 if items array is empty', async () => {
      mockRequest.body = {
        supplier_id: 'supplier-789',
        purchase_date: '2026-01-15',
        items: [],
      };

      await controller.createPurchase(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Purchase must have at least one item' })
      );
    });

    it('should return 400 if items is missing', async () => {
      mockRequest.body = { supplier_id: 'supplier-789', purchase_date: '2026-01-15' };

      await controller.createPurchase(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getPurchase', () => {
    it('should return purchase with items', async () => {
      mockRequest.params = { id: mockPurchaseId };
      mockPurchaseService.getPurchase.mockResolvedValue(mockPurchase);

      await controller.getPurchase(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: mockPurchase })
      );
    });

    it('should return 404 if not found', async () => {
      mockRequest.params = { id: mockPurchaseId };
      mockPurchaseService.getPurchase.mockRejectedValue(new Error('Purchase not found'));

      await controller.getPurchase(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });

  describe('listPurchases', () => {
    it('should list purchases with pagination', async () => {
      mockPurchaseService.listPurchases.mockResolvedValue({
        data: [mockPurchase],
        pagination: { page: 1, limit: 10, total: 1, total_pages: 1 },
      });

      await controller.listPurchases(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: [mockPurchase] })
      );
    });

    it('should pass custom pagination to service', async () => {
      mockRequest.query = { page: '2', limit: '5' };
      mockPurchaseService.listPurchases.mockResolvedValue({
        data: [], pagination: { page: 2, limit: 5, total: 0, total_pages: 0 },
      });

      await controller.listPurchases(mockRequest, mockResponse);

      expect(mockPurchaseService.listPurchases).toHaveBeenCalledWith(
        mockStoreId, expect.objectContaining({ page: 2, limit: 5 })
      );
    });
  });

  describe('updatePurchase', () => {
    it('should update payment status successfully', async () => {
      mockRequest.params = { id: mockPurchaseId };
      mockRequest.body = { payment_status: 'paid', paid_amount: 55 };
      mockPurchaseService.updatePurchase.mockResolvedValue({ ...mockPurchase, payment_status: 'paid' });

      await controller.updatePurchase(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Purchase updated successfully' })
      );
    });

    it('should return 404 if not found on update', async () => {
      mockRequest.params = { id: mockPurchaseId };
      mockRequest.body = { payment_status: 'paid' };
      mockPurchaseService.updatePurchase.mockRejectedValue(new Error('Purchase not found'));

      await controller.updatePurchase(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });

  describe('deletePurchase', () => {
    it('should delete purchase successfully', async () => {
      mockRequest.params = { id: mockPurchaseId };
      mockPurchaseService.deletePurchase.mockResolvedValue(undefined);

      await controller.deletePurchase(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Purchase deleted successfully' })
      );
    });

    it('should return 404 if not found on delete', async () => {
      mockRequest.params = { id: mockPurchaseId };
      mockPurchaseService.deletePurchase.mockRejectedValue(new Error('Purchase not found'));

      await controller.deletePurchase(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });
});
