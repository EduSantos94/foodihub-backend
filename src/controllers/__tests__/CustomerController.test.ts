import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CustomerController } from '../CustomerController.js';
import { CustomerService } from '../../services/CustomerService.js';

vi.mock('../../services/CustomerService.js');

describe('CustomerController', () => {
  let controller: CustomerController;
  let mockCustomerService: any;
  let mockRequest: any;
  let mockResponse: any;

  const mockStoreId = 'store-123';
  const mockCustomerId = 'customer-456';

  beforeEach(() => {
    vi.clearAllMocks();

    mockCustomerService = {
      createCustomer: vi.fn(),
      getCustomer: vi.fn(),
      listCustomers: vi.fn(),
      updateCustomer: vi.fn(),
      deleteCustomer: vi.fn(),
    } as any;

    controller = new CustomerController();
    (controller as any).customerService = mockCustomerService;

    mockRequest = {
      user: { store_id: mockStoreId },
      body: {},
      params: {},
      query: {},
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
  });

  describe('createCustomer', () => {
    it('should create customer successfully', async () => {
      const customerData = { first_name: 'João', email: 'joao@email.com', phone: '11999999999' };
      mockRequest.body = customerData;

      const mockCustomer = {
        id: mockCustomerId,
        store_id: mockStoreId,
        ...customerData,
        active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockCustomerService.createCustomer.mockResolvedValue(mockCustomer);

      await controller.createCustomer(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockCustomer,
          message: 'Customer created successfully',
        })
      );
    });

    it('should return 400 if first_name is missing', async () => {
      mockRequest.body = { email: 'test@email.com' };

      await controller.createCustomer(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'first_name is required',
        })
      );
    });
  });

  describe('getCustomer', () => {
    it('should get customer by id', async () => {
      mockRequest.params = { id: mockCustomerId };

      const mockCustomer = {
        id: mockCustomerId,
        store_id: mockStoreId,
        first_name: 'João',
        email: 'joao@email.com',
        active: true,
      };

      mockCustomerService.getCustomer.mockResolvedValue(mockCustomer);

      await controller.getCustomer(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockCustomer,
        })
      );
    });

    it('should return 404 if customer not found', async () => {
      mockRequest.params = { id: mockCustomerId };
      mockCustomerService.getCustomer.mockRejectedValue(new Error('Customer not found'));

      await controller.getCustomer(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });

  describe('listCustomers', () => {
    it('should list customers with default pagination', async () => {
      const mockCustomers = {
        data: [{ id: '1', first_name: 'João' }],
        pagination: { page: 1, limit: 10, total: 1, total_pages: 1 },
      };

      mockCustomerService.listCustomers.mockResolvedValue(mockCustomers);

      await controller.listCustomers(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockCustomers.data,
          pagination: mockCustomers.pagination,
        })
      );
    });

    it('should list customers with custom pagination', async () => {
      mockRequest.query = { page: '2', limit: '5' };

      const mockCustomers = {
        data: [],
        pagination: { page: 2, limit: 5, total: 0, total_pages: 0 },
      };

      mockCustomerService.listCustomers.mockResolvedValue(mockCustomers);

      await controller.listCustomers(mockRequest, mockResponse);

      expect(mockCustomerService.listCustomers).toHaveBeenCalledWith(
        mockStoreId,
        expect.objectContaining({ page: 2, limit: 5 })
      );
    });
  });

  describe('updateCustomer', () => {
    it('should update customer successfully', async () => {
      mockRequest.params = { id: mockCustomerId };
      mockRequest.body = { first_name: 'João Silva', email: 'joao@email.com' };

      const mockCustomer = {
        id: mockCustomerId,
        store_id: mockStoreId,
        first_name: 'João Silva',
        email: 'joao@email.com',
      };

      mockCustomerService.updateCustomer.mockResolvedValue(mockCustomer);

      await controller.updateCustomer(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Customer updated successfully',
        })
      );
    });

    it('should return 404 if customer not found on update', async () => {
      mockRequest.params = { id: mockCustomerId };
      mockRequest.body = { first_name: 'Updated' };
      mockCustomerService.updateCustomer.mockRejectedValue(new Error('Customer not found'));

      await controller.updateCustomer(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });

  describe('deleteCustomer', () => {
    it('should delete customer successfully', async () => {
      mockRequest.params = { id: mockCustomerId };
      mockCustomerService.deleteCustomer.mockResolvedValue(undefined);

      await controller.deleteCustomer(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Customer deleted successfully',
        })
      );
    });

    it('should return 404 if customer not found on delete', async () => {
      mockRequest.params = { id: mockCustomerId };
      mockCustomerService.deleteCustomer.mockRejectedValue(new Error('Customer not found'));

      await controller.deleteCustomer(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });
});
