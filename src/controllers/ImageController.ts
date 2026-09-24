import { Request, Response } from 'express';
import { ImageService } from '../services/ImageService.js';
import {
  CreateImageRequest,
  UpdateImageRequest,
  ImageListQuery,
  ImageTypeUnion,
} from '../types/index.js';

export class ImageController {
  private imageService: ImageService;

  constructor() {
    this.imageService = new ImageService();
  }

  async createImage(req: Request, res: Response): Promise<void> {
    try {
      const data: CreateImageRequest = req.body;

      if (!data.shop_id) {
        res.status(400).json({
          success: false,
          error: 'shop_id is required',
          status_code: 400,
          timestamp: new Date(),
        });
        return;
      }

      if (!data.type) {
        res.status(400).json({
          success: false,
          error: 'type is required',
          status_code: 400,
          timestamp: new Date(),
        });
        return;
      }

      if (!data.filename) {
        res.status(400).json({
          success: false,
          error: 'filename is required',
          status_code: 400,
          timestamp: new Date(),
        });
        return;
      }

      if (!data.rl_original) {
        res.status(400).json({
          success: false,
          error: 'rl_original is required',
          status_code: 400,
          timestamp: new Date(),
        });
        return;
      }

      const image = await this.imageService.createImage(data);
      res.status(201).json({
        success: true,
        data: image,
        message: 'Image created successfully',
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getImage(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: 'Invalid image ID',
          status_code: 400,
          timestamp: new Date(),
        });
        return;
      }

      const shopId = req.query.shop_id ? parseInt(req.query.shop_id as string, 10) : undefined;
      const image = await this.imageService.getImage(id, shopId);

      res.json({
        success: true,
        data: image,
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async listImages(req: Request, res: Response): Promise<void> {
    try {
      const query: ImageListQuery = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 10,
        shop_id: req.query.shop_id ? parseInt(req.query.shop_id as string, 10) : undefined,
        type: typeof req.query.type === 'string' ? (req.query.type as ImageTypeUnion) : undefined,
        type_id: req.query.type_id ? parseInt(req.query.type_id as string, 10) : undefined,
        active: req.query.active !== undefined ? req.query.active === 'true' : undefined,
      };

      const result = await this.imageService.listImages(query);
      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async updateImage(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: 'Invalid image ID',
          status_code: 400,
          timestamp: new Date(),
        });
        return;
      }

      const shopId = req.query.shop_id ? parseInt(req.query.shop_id as string, 10) : undefined;
      const data: UpdateImageRequest = req.body;

      const image = await this.imageService.updateImage(id, data, shopId);
      res.json({
        success: true,
        data: image,
        message: 'Image updated successfully',
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async deleteImage(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        res.status(400).json({
          success: false,
          error: 'Invalid image ID',
          status_code: 400,
          timestamp: new Date(),
        });
        return;
      }

      const shopId = req.query.shop_id ? parseInt(req.query.shop_id as string, 10) : undefined;
      await this.imageService.deleteImage(id, shopId);

      res.json({
        success: true,
        message: 'Image deleted successfully',
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
