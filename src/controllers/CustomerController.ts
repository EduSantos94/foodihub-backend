import { Request, Response } from 'express';
import { CustomerService } from '../services/CustomerService.js';
import { CreateCustomerRequest, UpdateCustomerRequest, PaginationQuery } from '../types/index.js';

export class CustomerController {
  private customerService: CustomerService;

  constructor() {
    this.customerService = new CustomerService();
  }

  async createCustomer(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user.store_id;
      const data: CreateCustomerRequest = req.body;

      if (!data.first_name) {
        res.status(400).json({
          success: false,
          error: 'first_name is required',
          status_code: 400,
          timestamp: new Date(),
        });
        return;
      }

      const customer = await this.customerService.createCustomer(storeId, data);
      res.status(201).json({
        success: true,
        data: customer,
        message: 'Customer created successfully',
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getCustomer(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user.store_id;
      const { id } = req.params;

      const customer = await this.customerService.getCustomer(id, storeId);
      res.json({
        success: true,
        data: customer,
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async listCustomers(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user.store_id;
      const query: PaginationQuery = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
      };

      const customers = await this.customerService.listCustomers(storeId, query);
      res.json({
        success: true,
        data: customers.data,
        pagination: customers.pagination,
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async updateCustomer(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user.store_id;
      const { id } = req.params;
      const data: UpdateCustomerRequest = req.body;

      const customer = await this.customerService.updateCustomer(id, storeId, data);
      res.json({
        success: true,
        data: customer,
        message: 'Customer updated successfully',
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async deleteCustomer(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user.store_id;
      const { id } = req.params;

      await this.customerService.deleteCustomer(id, storeId);
      res.json({
        success: true,
        message: 'Customer deleted successfully',
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  private handleError(error: any, res: Response): void {
    const message = error.message || 'Internal server error';
    const status = message.includes('not found') ? 404 : 400;

    res.status(status).json({
      success: false,
      error: message,
      status_code: status,
      timestamp: new Date(),
    });
  }
}
