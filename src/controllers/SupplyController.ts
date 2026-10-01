import { Request, Response } from 'express';
import { SupplyService } from '../services/SupplyService.js';
import { CreateSupplyRequest, UpdateSupplyRequest, PaginationQuery } from '../types/index.js';

export class SupplyController {
  private supplyService: SupplyService;

  constructor() {
    this.supplyService = new SupplyService();
  }

  async createSupply(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user.store_id;
      const data: CreateSupplyRequest = req.body;

      if (!data.name || !data.unit_measure) {
        res.status(400).json({
          success: false,
          error: 'name and unit_measure are required',
          status_code: 400,
          timestamp: new Date(),
        });
        return;
      }

      const supply = await this.supplyService.createSupply(storeId, data);
      res.status(201).json({ success: true, data: supply, message: 'Supply created successfully' });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getSupply(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user.store_id;
      const { id } = req.params;
      const supply = await this.supplyService.getSupply(id, storeId);
      res.json({ success: true, data: supply });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async listSupplies(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user.store_id;
      const query: PaginationQuery = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
      };
      const supplies = await this.supplyService.listSupplies(storeId, query);
      res.json({ success: true, data: supplies.data, pagination: supplies.pagination });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async updateSupply(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user.store_id;
      const { id } = req.params;
      const data: UpdateSupplyRequest = req.body;
      const supply = await this.supplyService.updateSupply(id, storeId, data);
      res.json({ success: true, data: supply, message: 'Supply updated successfully' });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async deleteSupply(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user.store_id;
      const { id } = req.params;
      await this.supplyService.deleteSupply(id, storeId);
      res.json({ success: true, message: 'Supply deleted successfully' });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  private handleError(error: any, res: Response): void {
    const message = error.message || 'Internal server error';
    const status = message.includes('not found') ? 404 : 400;
    res.status(status).json({ success: false, error: message, status_code: status, timestamp: new Date() });
  }
}
