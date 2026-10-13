import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SaleService } from '../SaleService.js';

vi.mock('../../database/connection.js', () => ({ createDataSource: vi.fn() }));

describe('SaleService', () => {
  let service: SaleService;
  let mockQueries: any;

  const storeId = 'store-123';
  const userId = 'user-1';
  const saleId = 'sale-456';

  const product = { id: 'prod-1', store_id: storeId, name: 'Cookie', price: '4.50', amount: 250, active: true };

  const savedSale = {
    id: saleId,
    store_id: storeId,
    subtotal: '9.00',
    discount: '0.00',
    tax: '0.00',
    total_amount: '9.00',
    status: 'pending',
    payment_method: 'cash',
    payment_status: 'pending',
    delivery_type: 'takeout',
    items: [
      { id: 'i1', sale_id: saleId, product_id: 'prod-1', product_name: 'Cookie', quantity: 2, unit_price: '4.50', total_price: '9.00' },
    ],
    integrations: [],
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SaleService();
    mockQueries = {
      findProductById: vi.fn(),
      findProductSize: vi.fn(),
      findCustomerById: vi.fn(),
      findIntegrationById: vi.fn(),
      createSaleWithItems: vi.fn(),
      findSaleById: vi.fn(),
      findAllByStore: vi.fn(),
      updateSale: vi.fn(),
      cancelSale: vi.fn(),
    };
    (service as any).queries = mockQueries;
  });

  describe('createSale', () => {
    it('should snapshot product name/price and calculate totals', async () => {
      mockQueries.findProductById.mockResolvedValue(product);
      mockQueries.createSaleWithItems.mockResolvedValue(saleId);
      mockQueries.findSaleById.mockResolvedValue(savedSale);

      const result = await service.createSale(storeId, userId, {
        discount: 1,
        tax: 0.5,
        items: [{ product_id: 'prod-1', quantity: 2 }],
      });

      const [saleData, items] = mockQueries.createSaleWithItems.mock.calls[0];
      expect(saleData).toMatchObject({
        store_id: storeId,
        created_by: userId,
        subtotal: 9,
        discount: 1,
        tax: 0.5,
        total_amount: 8.5,
        status: 'pending',
        payment_status: 'pending',
      });
      expect(items[0]).toMatchObject({ product_name: 'Cookie', unit_price: 4.5, total_price: 9, quantity: 2 });
      expect(result.total_amount).toBe(9);
      expect(result.items).toHaveLength(1);
    });

    it('should throw if there are no items', async () => {
      await expect(service.createSale(storeId, userId, { items: [] })).rejects.toThrow('at least one item');
    });

    it('should throw for non-positive or fractional quantity', async () => {
      await expect(
        service.createSale(storeId, userId, { items: [{ product_id: 'prod-1', quantity: 0 }] })
      ).rejects.toThrow('positive integer');
      await expect(
        service.createSale(storeId, userId, { items: [{ product_id: 'prod-1', quantity: 1.5 }] })
      ).rejects.toThrow('positive integer');
    });

    it('should throw if product is not found in the store', async () => {
      mockQueries.findProductById.mockResolvedValue(null);
      await expect(
        service.createSale(storeId, userId, { items: [{ product_id: 'other', quantity: 1 }] })
      ).rejects.toThrow('Product not found');
      expect(mockQueries.createSaleWithItems).not.toHaveBeenCalled();
    });

    it('should throw if product is inactive', async () => {
      mockQueries.findProductById.mockResolvedValue({ ...product, active: false });
      await expect(
        service.createSale(storeId, userId, { items: [{ product_id: 'prod-1', quantity: 1 }] })
      ).rejects.toThrow('inactive');
    });

    it('should throw if customer is not found', async () => {
      mockQueries.findCustomerById.mockResolvedValue(null);
      await expect(
        service.createSale(storeId, userId, { customer_id: 'c1', items: [{ product_id: 'prod-1', quantity: 1 }] })
      ).rejects.toThrow('Customer not found');
    });

    it('should throw if integration is not found', async () => {
      mockQueries.findIntegrationById.mockResolvedValue(null);
      await expect(
        service.createSale(storeId, userId, {
          items: [{ product_id: 'prod-1', quantity: 1 }],
          integration: { integration_id: 'int-1', origin: 'ifood' },
        })
      ).rejects.toThrow('Integration not found');
    });

    it('should throw if discount exceeds the total', async () => {
      mockQueries.findProductById.mockResolvedValue(product);
      await expect(
        service.createSale(storeId, userId, { discount: 100, items: [{ product_id: 'prod-1', quantity: 1 }] })
      ).rejects.toThrow('discount cannot be greater');
    });

    it('should pass the integration record to the transaction', async () => {
      mockQueries.findProductById.mockResolvedValue(product);
      mockQueries.findIntegrationById.mockResolvedValue({ id: 'int-1' });
      mockQueries.createSaleWithItems.mockResolvedValue(saleId);
      mockQueries.findSaleById.mockResolvedValue(savedSale);

      await service.createSale(storeId, userId, {
        items: [{ product_id: 'prod-1', quantity: 1 }],
        integration: { integration_id: 'int-1', origin: 'ifood', external_id: 'EXT-1' },
      });

      expect(mockQueries.createSaleWithItems.mock.calls[0][2]).toMatchObject({
        integration_id: 'int-1',
        origin: 'ifood',
        external_id: 'EXT-1',
        sync_status: 'pending',
      });
    });

    it('should propagate insufficient stock errors', async () => {
      mockQueries.findProductById.mockResolvedValue(product);
      mockQueries.createSaleWithItems.mockRejectedValue(new Error('Insufficient stock for product prod-1'));
      await expect(
        service.createSale(storeId, userId, { items: [{ product_id: 'prod-1', quantity: 999 }] })
      ).rejects.toThrow('Insufficient stock');
    });
  });

  describe('getSale / listSales', () => {
    it('should return a sale', async () => {
      mockQueries.findSaleById.mockResolvedValue(savedSale);
      const result = await service.getSale(saleId, storeId);
      expect(result.id).toBe(saleId);
      expect(result.subtotal).toBe(9);
    });

    it('should throw if sale not found', async () => {
      mockQueries.findSaleById.mockResolvedValue(null);
      await expect(service.getSale('x', storeId)).rejects.toThrow('Sale not found');
    });

    it('should list with pagination and status filter', async () => {
      mockQueries.findAllByStore.mockResolvedValue([[savedSale], 1]);
      const result = await service.listSales(storeId, { page: 2, limit: 5, status: 'pending' });
      expect(mockQueries.findAllByStore).toHaveBeenCalledWith(storeId, 'pending', 5, 5);
      expect(result.pagination).toEqual({ page: 2, limit: 5, total: 1, total_pages: 1 });
    });
  });

  describe('updateSale', () => {
    it('should set paid_at when payment becomes paid', async () => {
      mockQueries.findSaleById.mockResolvedValue(savedSale);
      mockQueries.updateSale.mockResolvedValue({ ...savedSale, payment_status: 'paid' });

      await service.updateSale(saleId, storeId, { payment_status: 'paid' });

      expect(mockQueries.updateSale).toHaveBeenCalledWith(
        saleId,
        storeId,
        expect.objectContaining({ payment_status: 'paid', paid_at: expect.any(Date) })
      );
    });

    it('should route status=cancelled through cancelSale (restoring stock)', async () => {
      mockQueries.findSaleById
        .mockResolvedValueOnce(savedSale)
        .mockResolvedValueOnce(savedSale)
        .mockResolvedValueOnce({ ...savedSale, status: 'cancelled' });

      const result = await service.updateSale(saleId, storeId, { status: 'cancelled' });

      expect(mockQueries.cancelSale).toHaveBeenCalled();
      expect(mockQueries.updateSale).not.toHaveBeenCalled();
      expect(result.status).toBe('cancelled');
    });

    it('should not change a cancelled sale', async () => {
      mockQueries.findSaleById.mockResolvedValue({ ...savedSale, status: 'cancelled' });
      await expect(service.updateSale(saleId, storeId, { notes: 'x' })).rejects.toThrow('Cancelled sales');
    });

    it('should throw if sale not found', async () => {
      mockQueries.findSaleById.mockResolvedValue(null);
      await expect(service.updateSale('x', storeId, {})).rejects.toThrow('Sale not found');
    });
  });

  describe('cancelSale', () => {
    it('should give item quantities back to stock', async () => {
      mockQueries.findSaleById
        .mockResolvedValueOnce(savedSale)
        .mockResolvedValueOnce({ ...savedSale, status: 'cancelled' });

      const result = await service.cancelSale(saleId, storeId);

      expect(mockQueries.cancelSale).toHaveBeenCalledWith(saleId, storeId, [{ product_id: 'prod-1', quantity: 2 }]);
      expect(result.status).toBe('cancelled');
    });

    it('should refuse to cancel twice', async () => {
      mockQueries.findSaleById.mockResolvedValue({ ...savedSale, status: 'cancelled' });
      await expect(service.cancelSale(saleId, storeId)).rejects.toThrow('already cancelled');
      expect(mockQueries.cancelSale).not.toHaveBeenCalled();
    });

    it('should refuse to cancel a delivered sale', async () => {
      mockQueries.findSaleById.mockResolvedValue({ ...savedSale, status: 'delivered' });
      await expect(service.cancelSale(saleId, storeId)).rejects.toThrow('Delivered');
    });

    it('should throw if sale not found', async () => {
      mockQueries.findSaleById.mockResolvedValue(null);
      await expect(service.cancelSale('x', storeId)).rejects.toThrow('Sale not found');
    });
  });
});
