import { Request, Response } from 'express';
import { SupplierService } from '../services/SupplierService.js';
import { CreateSupplierRequest, UpdateSupplierRequest, PaginationQuery } from '../types/index.js';

export class SupplierController {
  private supplierService: SupplierService;

  constructor() {
    this.supplierService = new SupplierService();
  }

  async createSupplier(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user.store_id;
      const data: CreateSupplierRequest = req.body;

      if (!data.name) {
        res.status(400).json({
          success: false,
          error: 'name is required',
          status_code: 400,
          timestamp: new Date(),
        });
        return;
      }

      const supplier = await this.supplierService.createSupplier(storeId, data);
      res.status(201).json({
        success: true,
        data: supplier,
        message: 'Supplier created successfully',
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getSupplier(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user.store_id;
      const { id } = req.params;

      const supplier = await this.supplierService.getSupplier(id, storeId);
      res.json({ success: true, data: supplier });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async listSuppliers(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user.store_id;
      const query: PaginationQuery = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
      };

      const suppliers = await this.supplierService.listSuppliers(storeId, query);
      res.json({
        success: true,
        data: suppliers.data,
        pagination: suppliers.pagination,
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async updateSupplier(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user.store_id;
      const { id } = req.params;
      const data: UpdateSupplierRequest = req.body;

      const supplier = await this.supplierService.updateSupplier(id, storeId, data);
      res.json({
        success: true,
        data: supplier,
        message: 'Supplier updated successfully',
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async deleteSupplier(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user.store_id;
      const { id } = req.params;

      await this.supplierService.deleteSupplier(id, storeId);
      res.json({ success: true, message: 'Supplier deleted successfully' });
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
