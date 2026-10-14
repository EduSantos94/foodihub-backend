import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StoreController } from '../StoreController.js';

vi.mock('../../services/StoreService.js');

describe('StoreController', () => {
  let controller: StoreController;
  let mockService: any;
  let res: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockService = { getStoreById: vi.fn(), updateStore: vi.fn(), deactivateStore: vi.fn(), softDeleteStore: vi.fn() };
    controller = new StoreController();
    (controller as any).storeService = mockService;
    res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  });

  it('getMyStore returns only the store of the logged user, in the paginated shape', async () => {
    mockService.getStoreById.mockResolvedValue({ id: 'store-1', name: 'Mine' });

    await controller.getMyStore({ user: { store_id: 'store-1' } } as any, res);

    expect(mockService.getStoreById).toHaveBeenCalledWith('store-1');
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: {
        data: [{ id: 'store-1', name: 'Mine' }],
        pagination: { page: 1, limit: 1, total: 1, total_pages: 1 },
      },
    });
  });

  it('should have no public listing or creation left', () => {
    expect((controller as any).getAllStores).toBeUndefined();
    expect((controller as any).createStore).toBeUndefined();
  });
});
