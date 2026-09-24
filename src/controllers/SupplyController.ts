import { Request, Response } from 'express';
import { SupplyService } from '../services/SupplyService.js';
import {
  CreateSupplyRequest,
  UpdateSupplyRequest,
  SupplyListQuery,
  SupplyTypeUnion,
} from '../types/index.js';
import { AuthRequest } from '../middleware/auth.js';

export class SupplyController {
  private supplyService: SupplyService;

  constructor() {
    this.supplyService = new SupplyService();
  }

  private getStoreId(req: Request): string {
    const user = (req as AuthRequest).user;
    if (user && typeof user === 'object' && 'store_id' in user && typeof user.store_id === 'string') {
      return user.store_id;
    }
    if (typeof req.headers['x-store-id'] === 'string') {
      return req.headers['x-store-id'];
    }
    if (typeof req.query.store_id === 'string') {
      return req.query.store_id;
    }
    if (req.body && typeof req.body === 'object' && 'store_id' in req.body && typeof req.body.store_id === 'string') {
      return req.body.store_id;
    }
    return '';
  }

  async createSupply(req: Request, res: Response): Promise<void> {
    try {
      const storeId = this.getStoreId(req);
      if (!storeId) {
        res.status(400).json({
          success: false,
          error: 'store_id is required',
          status_code: 400,
          timestamp: new Date(),
        });
        return;
      }

      const data: CreateSupplyRequest = req.body;

      if (!data.name || !data.name.trim()) {
        res.status(400).json({
          success: false,
          error: 'name is required',
          status_code: 400,
          timestamp: new Date(),
        });
        return;
      }

      if (!data.unit_measure) {
        res.status(400).json({
          success: false,
          error: 'unit_measure is required',
          status_code: 400,
          timestamp: new Date(),
        });
        return;
      }

      const supply = await this.supplyService.createSupply(storeId, data);
      res.status(201).json({
        success: true,
        data: supply,
        message: 'Supply created successfully',
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getSupply(req: Request, res: Response): Promise<void> {
    try {
      const storeId = this.getStoreId(req);
      if (!storeId) {
        res.status(400).json({
          success: false,
          error: 'store_id is required',
          status_code: 400,
          timestamp: new Date(),
        });
        return;
      }

      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: 'Invalid supply ID',
          status_code: 400,
          timestamp: new Date(),
        });
        return;
      }

      const supply = await this.supplyService.getSupply(id, storeId);
      res.json({
        success: true,
        data: supply,
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async listSupplies(req: Request, res: Response): Promise<void> {
    try {
      const storeId = this.getStoreId(req);
      if (!storeId) {
        res.status(400).json({
          success: false,
          error: 'store_id is required',
          status_code: 400,
          timestamp: new Date(),
        });
        return;
      }

      const query: SupplyListQuery = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 10,
        type: typeof req.query.type === 'string' ? (req.query.type as SupplyTypeUnion) : undefined,
        active: req.query.active !== undefined ? req.query.active === 'true' : undefined,
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
      };

      const result = await this.supplyService.listSupplies(storeId, query);
      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async updateSupply(req: Request, res: Response): Promise<void> {
    try {
      const storeId = this.getStoreId(req);
      if (!storeId) {
        res.status(400).json({
          success: false,
          error: 'store_id is required',
          status_code: 400,
          timestamp: new Date(),
        });
        return;
      }

      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: 'Invalid supply ID',
          status_code: 400,
          timestamp: new Date(),
        });
        return;
      }

      const data: UpdateSupplyRequest = req.body;
      const supply = await this.supplyService.updateSupply(id, storeId, data);
      res.json({
        success: true,
        data: supply,
        message: 'Supply updated successfully',
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async deleteSupply(req: Request, res: Response): Promise<void> {
    try {
      const storeId = this.getStoreId(req);
      if (!storeId) {
        res.status(400).json({
          success: false,
          error: 'store_id is required',
          status_code: 400,
          timestamp: new Date(),
        });
        return;
      }

      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: 'Invalid supply ID',
          status_code: 400,
          timestamp: new Date(),
        });
        return;
      }

      await this.supplyService.deleteSupply(id, storeId);
      res.json({
        success: true,
        message: 'Supply deleted successfully',
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  private handleError(error: unknown, res: Response): void {
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = message.includes('not found') ? 404 : 400;

    res.status(status).json({
      success: false,
      error: message,
      status_code: status,
      timestamp: new Date(),
    });
  }
}
