import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PurchaseService } from '../PurchaseService.js';

vi.mock('../../database/connection.js', () => ({ createDataSource: vi.fn() }));

describe('PurchaseService', () => {
  let service: PurchaseService;
  let mockQueries: any;

  const mockStoreId = 'store-123';
  const mockPurchaseId = 'purchase-456';
  const mockSupplierId = 'supplier-789';

  const mockItem = {
    id: 'item-1',
    purchase_id: mockPurchaseId,
    supply_id: 'supply-1',
    quantity: 10,
    unit_price: 5.5,
    total_price: 55,
    batch_number: 'LOT001',
    expiry_date: new Date('2027-01-01'),
  };

  const mockPurchase = {
    id: mockPurchaseId,
    store_id: mockStoreId,
    supplier_id: mockSupplierId,
    purchase_date: new Date('2026-01-15'),
    total_amount: 55,
    paid_amount: 0,
    payment_status: 'pending',
    payment_method: 'pix',
    items: [mockItem],
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PurchaseService();
    mockQueries = {
      findSupplierById: vi.fn().mockResolvedValue({ id: mockSupplierId, store_id: mockStoreId }),
      countSuppliesInStore: vi.fn(async (ids: string[]) => ids.length),
      createPurchaseWithItems: vi.fn().mockResolvedValue(mockPurchaseId),
      findPurchaseById: vi.fn(),
      findAllByStore: vi.fn(),
      updatePurchase: vi.fn(),
      deletePurchaseAndRevertStock: vi.fn(),
    };
  });

  describe('createPurchase', () => {
    it('should create purchase with items, calculate total and add supply stock in one call', async () => {
      mockQueries.findPurchaseById.mockResolvedValue(mockPurchase);
      (service as any).queries = mockQueries;

      const result = await service.createPurchase(mockStoreId, {
        supplier_id: mockSupplierId,
        purchase_date: '2026-01-15',
        payment_method: 'pix',
        items: [{ supply_id: 'supply-1', quantity: 10, unit_price: 5.5 }],
      });

      expect(result.total_amount).toBe(55);
      expect(result.payment_status).toBe('pending');
      expect(result.items).toHaveLength(1);
      expect(mockQueries.createPurchaseWithItems).toHaveBeenCalledWith(
        expect.objectContaining({
          store_id: mockStoreId,
          supplier_id: mockSupplierId,
          total_amount: 55,
          paid_amount: 0,
          payment_status: 'pending',
        }),
        [expect.objectContaining({ supply_id: 'supply-1', quantity: 10, unit_price: 5.5, total_price: 55 })]
      );
    });

    it('should throw if no items provided', async () => {
      (service as any).queries = mockQueries;

      await expect(
        service.createPurchase(mockStoreId, {
          supplier_id: mockSupplierId,
          purchase_date: '2026-01-15',
          items: [],
        })
      ).rejects.toThrow('Purchase must have at least one item');
    });

    it('should calculate total from multiple items', async () => {
      mockQueries.findPurchaseById.mockResolvedValue({ ...mockPurchase, total_amount: 150 });
      (service as any).queries = mockQueries;

      await service.createPurchase(mockStoreId, {
        supplier_id: mockSupplierId,
        purchase_date: '2026-01-15',
        items: [
          { supply_id: 'supply-1', quantity: 10, unit_price: 5 },
          { supply_id: 'supply-2', quantity: 20, unit_price: 5 },
        ],
      });

      expect(mockQueries.createPurchaseWithItems).toHaveBeenCalledWith(
        expect.objectContaining({ total_amount: 150 }),
        expect.any(Array)
      );
    });

    it('should reject a supplier from another store', async () => {
      mockQueries.findSupplierById.mockResolvedValue(null);
      (service as any).queries = mockQueries;

      await expect(
        service.createPurchase(mockStoreId, {
          supplier_id: 'foreign',
          purchase_date: '2026-01-15',
          items: [{ supply_id: 'supply-1', quantity: 1, unit_price: 1 }],
        })
      ).rejects.toThrow('Supplier not found');
      expect(mockQueries.createPurchaseWithItems).not.toHaveBeenCalled();
    });

    it('should reject supplies that do not belong to the store', async () => {
      mockQueries.countSuppliesInStore.mockResolvedValue(1);
      (service as any).queries = mockQueries;

      await expect(
        service.createPurchase(mockStoreId, {
          supplier_id: mockSupplierId,
          purchase_date: '2026-01-15',
          items: [
            { supply_id: 'supply-1', quantity: 1, unit_price: 1 },
            { supply_id: 'foreign-supply', quantity: 1, unit_price: 1 },
          ],
        })
      ).rejects.toThrow('Supply not found');
      expect(mockQueries.createPurchaseWithItems).not.toHaveBeenCalled();
    });

    it('should count a repeated supply only once when validating', async () => {
      mockQueries.findPurchaseById.mockResolvedValue(mockPurchase);
      (service as any).queries = mockQueries;

      await service.createPurchase(mockStoreId, {
        supplier_id: mockSupplierId,
        purchase_date: '2026-01-15',
        items: [
          { supply_id: 'supply-1', quantity: 1, unit_price: 1 },
          { supply_id: 'supply-1', quantity: 2, unit_price: 1 },
        ],
      });

      expect(mockQueries.countSuppliesInStore).toHaveBeenCalledWith(['supply-1'], mockStoreId);
    });

    it('should reject non-positive quantities and negative prices', async () => {
      (service as any).queries = mockQueries;

      await expect(
        service.createPurchase(mockStoreId, {
          supplier_id: mockSupplierId,
          purchase_date: '2026-01-15',
          items: [{ supply_id: 'supply-1', quantity: 0, unit_price: 1 }],
        })
      ).rejects.toThrow('greater than zero');
      await expect(
        service.createPurchase(mockStoreId, {
          supplier_id: mockSupplierId,
          purchase_date: '2026-01-15',
          items: [{ supply_id: 'supply-1', quantity: 1, unit_price: -1 }],
        })
      ).rejects.toThrow('negative');
    });
  });

  describe('getPurchase', () => {
    it('should return purchase with items', async () => {
      mockQueries.findPurchaseById.mockResolvedValue(mockPurchase);
      (service as any).queries = mockQueries;

      const result = await service.getPurchase(mockPurchaseId, mockStoreId);

      expect(result.id).toBe(mockPurchaseId);
      expect(result.items).toHaveLength(1);
      expect(result.total_amount).toBe(55);
    });

    it('should throw if purchase not found', async () => {
      mockQueries.findPurchaseById.mockResolvedValue(null);
      (service as any).queries = mockQueries;

      await expect(service.getPurchase(mockPurchaseId, mockStoreId)).rejects.toThrow('Purchase not found');
    });
  });

  describe('listPurchases', () => {
    it('should list purchases with pagination', async () => {
      mockQueries.findAllByStore.mockResolvedValue([[mockPurchase], 1]);
      (service as any).queries = mockQueries;

      const result = await service.listPurchases(mockStoreId, { page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });

    it('should calculate correct skip', async () => {
      mockQueries.findAllByStore.mockResolvedValue([[], 0]);
      (service as any).queries = mockQueries;

      await service.listPurchases(mockStoreId, { page: 2, limit: 10 });

      expect(mockQueries.findAllByStore).toHaveBeenCalledWith(mockStoreId, 10, 10);
    });
  });

  describe('updatePurchase', () => {
    it('should update payment status successfully', async () => {
      const updated = { ...mockPurchase, payment_status: 'paid', paid_amount: 55 };
      mockQueries.findPurchaseById
        .mockResolvedValueOnce(mockPurchase)
        .mockResolvedValueOnce(updated);
      mockQueries.updatePurchase.mockResolvedValue(updated);
      (service as any).queries = mockQueries;

      const result = await service.updatePurchase(mockPurchaseId, mockStoreId, {
        payment_status: 'paid',
        paid_amount: 55,
      });

      expect(result.payment_status).toBe('paid');
      expect(result.paid_amount).toBe(55);
    });

    it('should throw if purchase not found on update', async () => {
      mockQueries.findPurchaseById.mockResolvedValue(null);
      (service as any).queries = mockQueries;

      await expect(
        service.updatePurchase(mockPurchaseId, mockStoreId, { payment_status: 'paid' })
      ).rejects.toThrow('Purchase not found');
    });
  });

  describe('deletePurchase', () => {
    it('should delete purchase successfully', async () => {
      mockQueries.findPurchaseById.mockResolvedValue(mockPurchase);
      mockQueries.deletePurchaseAndRevertStock.mockResolvedValue(true);
      (service as any).queries = mockQueries;

      await service.deletePurchase(mockPurchaseId, mockStoreId);

      expect(mockQueries.deletePurchaseAndRevertStock).toHaveBeenCalledWith(
        mockPurchaseId,
        mockStoreId,
        [{ supply_id: 'supply-1', quantity: 10 }]
      );
    });

    it('should throw if purchase not found on delete', async () => {
      mockQueries.findPurchaseById.mockResolvedValue(null);
      (service as any).queries = mockQueries;

      await expect(service.deletePurchase(mockPurchaseId, mockStoreId)).rejects.toThrow('Purchase not found');
    });
  });
});
