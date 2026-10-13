import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SaleController } from '../SaleController.js';

vi.mock('../../services/SaleService.js');

describe('SaleController', () => {
  let controller: SaleController;
  let mockService: any;
  let req: any;
  let res: any;

  const storeId = 'store-123';
  const sale = { id: 'sale-1', store_id: storeId, total_amount: 9, status: 'pending' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockService = {
      createSale: vi.fn(),
      getSale: vi.fn(),
      listSales: vi.fn(),
      updateSale: vi.fn(),
      cancelSale: vi.fn(),
    };
    controller = new SaleController();
    (controller as any).saleService = mockService;
    req = { user: { store_id: storeId, id: 'user-1' }, body: {}, params: {}, query: {} };
    res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  });

  describe('createSale', () => {
    it('should create a sale (201) passing the user id', async () => {
      req.body = { items: [{ product_id: 'p1', quantity: 2 }] };
      mockService.createSale.mockResolvedValue(sale);

      await controller.createSale(req, res);

      expect(mockService.createSale).toHaveBeenCalledWith(storeId, 'user-1', req.body);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('should return 400 without items', async () => {
      req.body = { items: [] };
      await controller.createSale(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockService.createSale).not.toHaveBeenCalled();
    });

    it('should return 400 on insufficient stock', async () => {
      req.body = { items: [{ product_id: 'p1', quantity: 99 }] };
      mockService.createSale.mockRejectedValue(new Error('Insufficient stock for product p1'));
      await controller.createSale(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 when a product is not found', async () => {
      req.body = { items: [{ product_id: 'p1', quantity: 1 }] };
      mockService.createSale.mockRejectedValue(new Error('Product not found'));
      await controller.createSale(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getSale', () => {
    it('should return the sale', async () => {
      req.params = { id: 'sale-1' };
      mockService.getSale.mockResolvedValue(sale);
      await controller.getSale(req, res);
      expect(mockService.getSale).toHaveBeenCalledWith('sale-1', storeId);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: sale });
    });

    it('should return 404 when not found', async () => {
      req.params = { id: 'x' };
      mockService.getSale.mockRejectedValue(new Error('Sale not found'));
      await controller.getSale(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('listSales', () => {
    it('should list with pagination and status', async () => {
      req.query = { page: '2', limit: '5', status: 'pending' };
      mockService.listSales.mockResolvedValue({ data: [sale], pagination: { page: 2, limit: 5, total: 1, total_pages: 1 } });

      await controller.listSales(req, res);

      expect(mockService.listSales).toHaveBeenCalledWith(storeId, { page: 2, limit: 5, status: 'pending' });
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: [sale] }));
    });

    it('should reject an invalid status filter', async () => {
      req.query = { status: 'bogus' };
      await controller.listSales(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockService.listSales).not.toHaveBeenCalled();
    });
  });

  describe('updateSale / cancelSale', () => {
    it('should update a sale', async () => {
      req.params = { id: 'sale-1' };
      req.body = { payment_status: 'paid' };
      mockService.updateSale.mockResolvedValue(sale);
      await controller.updateSale(req, res);
      expect(mockService.updateSale).toHaveBeenCalledWith('sale-1', storeId, req.body);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Sale updated successfully' }));
    });

    it('should cancel a sale', async () => {
      req.params = { id: 'sale-1' };
      mockService.cancelSale.mockResolvedValue({ ...sale, status: 'cancelled' });
      await controller.cancelSale(req, res);
      expect(mockService.cancelSale).toHaveBeenCalledWith('sale-1', storeId);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Sale cancelled successfully' }));
    });

    it('should return 400 when already cancelled', async () => {
      req.params = { id: 'sale-1' };
      mockService.cancelSale.mockRejectedValue(new Error('Sale is already cancelled'));
      await controller.cancelSale(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});
