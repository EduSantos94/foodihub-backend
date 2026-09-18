import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CustomerService } from '../CustomerService.js';

vi.mock('../../database/connection.js', () => ({
  createDataSource: vi.fn(),
}));

describe('CustomerService', () => {
  let service: CustomerService;
  let mockQueries: any;

  const mockStoreId = 'store-123';
  const mockCustomerId = 'customer-456';

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CustomerService();
    mockQueries = {
      createCustomer: vi.fn(),
      findCustomerById: vi.fn(),
      findCustomerByEmail: vi.fn(),
      findAllByStore: vi.fn(),
      updateCustomer: vi.fn(),
      softDeleteCustomer: vi.fn(),
    } as any;
  });

  describe('createCustomer', () => {
    it('should create customer successfully', async () => {
      const data = { first_name: 'João', email: 'joao@email.com', phone: '11999999999' };
      const mockCustomer = {
        id: mockCustomerId,
        store_id: mockStoreId,
        ...data,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQueries.findCustomerByEmail.mockResolvedValue(null);
      mockQueries.createCustomer.mockResolvedValue(mockCustomer);
      (service as any).queries = mockQueries;

      const result = await service.createCustomer(mockStoreId, data);

      expect(result.first_name).toBe('João');
      expect(result.email).toBe('joao@email.com');
      expect(result.phone).toBe('11999999999');
      expect(result.active).toBe(true);
    });

    it('should throw error if email already exists for this store', async () => {
      const data = { first_name: 'João', email: 'joao@email.com' };
      const existingCustomer = { id: 'existing', email: 'joao@email.com' };

      mockQueries.findCustomerByEmail.mockResolvedValue(existingCustomer);
      (service as any).queries = mockQueries;

      await expect(service.createCustomer(mockStoreId, data)).rejects.toThrow(
        'Customer with this email already exists in this store'
      );
    });
  });

  describe('getCustomer', () => {
    it('should get customer by id', async () => {
      const mockCustomer = {
        id: mockCustomerId,
        store_id: mockStoreId,
        first_name: 'João',
        email: 'joao@email.com',
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQueries.findCustomerById.mockResolvedValue(mockCustomer);
      (service as any).queries = mockQueries;

      const result = await service.getCustomer(mockCustomerId, mockStoreId);

      expect(result.first_name).toBe('João');
      expect(result.id).toBe(mockCustomerId);
      expect(mockQueries.findCustomerById).toHaveBeenCalledWith(mockCustomerId, mockStoreId);
    });

    it('should throw error if customer not found', async () => {
      mockQueries.findCustomerById.mockResolvedValue(null);
      (service as any).queries = mockQueries;

      await expect(service.getCustomer(mockCustomerId, mockStoreId)).rejects.toThrow(
        'Customer not found'
      );
    });
  });

  describe('listCustomers', () => {
    it('should list customers with pagination', async () => {
      const mockCustomers = [
        {
          id: '1',
          first_name: 'João',
          active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          id: '2',
          first_name: 'Maria',
          active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockQueries.findAllByStore.mockResolvedValue([mockCustomers, 2]);
      (service as any).queries = mockQueries;

      const result = await service.listCustomers(mockStoreId, { page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.data[0].first_name).toBe('João');
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.total).toBe(2);
    });

    it('should calculate correct skip for pagination', async () => {
      mockQueries.findAllByStore.mockResolvedValue([[], 0]);
      (service as any).queries = mockQueries;

      await service.listCustomers(mockStoreId, { page: 3, limit: 5 });

      expect(mockQueries.findAllByStore).toHaveBeenCalledWith(mockStoreId, false, 10, 5);
    });
  });

  describe('updateCustomer', () => {
    it('should update customer successfully', async () => {
      const existingCustomer = { id: mockCustomerId, store_id: mockStoreId, email: 'joao@email.com' };
      const updateData = { first_name: 'João Silva', phone: '11999999999' };
      const updatedCustomer = {
        id: mockCustomerId,
        store_id: mockStoreId,
        ...updateData,
        email: 'joao@email.com',
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockQueries.findCustomerById.mockResolvedValue(existingCustomer);
      mockQueries.findCustomerByEmail.mockResolvedValue(null);
      mockQueries.updateCustomer.mockResolvedValue(updatedCustomer);
      (service as any).queries = mockQueries;

      const result = await service.updateCustomer(mockCustomerId, mockStoreId, updateData);

      expect(result.first_name).toBe('João Silva');
      expect(result.phone).toBe('11999999999');
    });

    it('should throw error if customer not found on update', async () => {
      mockQueries.findCustomerById.mockResolvedValue(null);
      (service as any).queries = mockQueries;

      await expect(
        service.updateCustomer(mockCustomerId, mockStoreId, { first_name: 'Updated' })
      ).rejects.toThrow('Customer not found');
    });

    it('should throw error if new email already exists', async () => {
      const existingCustomer = { id: mockCustomerId, store_id: mockStoreId, email: 'joao@email.com' };
      const duplicateCustomer = { id: 'other-id', email: 'maria@email.com' };

      mockQueries.findCustomerById.mockResolvedValue(existingCustomer);
      mockQueries.findCustomerByEmail.mockResolvedValue(duplicateCustomer);
      (service as any).queries = mockQueries;

      await expect(
        service.updateCustomer(mockCustomerId, mockStoreId, { email: 'maria@email.com' })
      ).rejects.toThrow('Customer with this email already exists in this store');
    });
  });

  describe('deleteCustomer', () => {
    it('should delete customer successfully', async () => {
      const mockCustomer = { id: mockCustomerId, store_id: mockStoreId, first_name: 'João' };

      mockQueries.findCustomerById.mockResolvedValue(mockCustomer);
      mockQueries.softDeleteCustomer.mockResolvedValue(true);
      (service as any).queries = mockQueries;

      await service.deleteCustomer(mockCustomerId, mockStoreId);

      expect(mockQueries.softDeleteCustomer).toHaveBeenCalledWith(mockCustomerId, mockStoreId);
    });

    it('should throw error if customer not found on delete', async () => {
      mockQueries.findCustomerById.mockResolvedValue(null);
      (service as any).queries = mockQueries;

      await expect(service.deleteCustomer(mockCustomerId, mockStoreId)).rejects.toThrow(
        'Customer not found'
      );
    });
  });
});
