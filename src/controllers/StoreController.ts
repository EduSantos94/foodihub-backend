import { Request, Response } from 'express';
import { StoreService } from '../services/StoreService.js';
import { CreateStoreRequest, UpdateStoreRequest, PaginationQuery } from '../types/index.js';

export class StoreController {
  private storeService: StoreService;

  constructor() {
    this.storeService = new StoreService();
  }

  async createStore(req: Request, res: Response): Promise<void> {
    try {
      const data: CreateStoreRequest = req.body;
      const store = await this.storeService.createStore(data);
      res.status(201).json({
        success: true,
        data: store,
        message: 'Store created successfully',
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getStore(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const store = await this.storeService.getStoreById(id);
      res.json({
        success: true,
        data: store,
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async updateStore(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const data: UpdateStoreRequest = req.body;
      const store = await this.storeService.updateStore(id, data);
      res.json({
        success: true,
        data: store,
        message: 'Store updated successfully',
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getAllStores(req: Request, res: Response): Promise<void> {
    try {
      const query: PaginationQuery = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
        order: (req.query.order as 'ASC' | 'DESC') || 'DESC',
      };
      const stores = await this.storeService.getAllStores(query);
      res.json({
        success: true,
        data: stores,
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async deactivateStore(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const store = await this.storeService.deactivateStore(id);
      res.json({
        success: true,
        data: store,
        message: 'Store deactivated successfully',
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async deleteStore(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await this.storeService.softDeleteStore(id);
      res.json({
        success: true,
        message: 'Store deleted successfully',
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
