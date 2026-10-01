import { Request, Response } from 'express';
import { ImageService } from '../services/ImageService.js';
import { CreateImageRequest, UpdateImageRequest, ImageEntityType, PaginationQuery } from '../types/index.js';

const VALID_ENTITY_TYPES: ImageEntityType[] = ['store', 'product', 'supplier', 'banner', 'category', 'promotional', 'other'];

export class ImageController {
  private imageService: ImageService;

  constructor() {
    this.imageService = new ImageService();
  }

  async createImage(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user.store_id;
      const data: CreateImageRequest = req.body;

      if (!data.filename || !data.url_original || !data.entity_type) {
        res.status(400).json({
          success: false,
          error: 'filename, url_original and entity_type are required',
          status_code: 400,
          timestamp: new Date(),
        });
        return;
      }

      if (!VALID_ENTITY_TYPES.includes(data.entity_type)) {
        res.status(400).json({
          success: false,
          error: `entity_type must be one of: ${VALID_ENTITY_TYPES.join(', ')}`,
          status_code: 400,
          timestamp: new Date(),
        });
        return;
      }

      const image = await this.imageService.createImage(storeId, data);
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
      const storeId = (req as any).user.store_id;
      const { id } = req.params;
      const image = await this.imageService.getImage(id, storeId);
      res.json({ success: true, data: image });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async listImages(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user.store_id;
      const query: PaginationQuery = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
      };
      const images = await this.imageService.listImages(storeId, query);
      res.json({ success: true, data: images.data, pagination: images.pagination });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async listImagesByEntity(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user.store_id;
      const { entityType } = req.params;
      const { entity_id } = req.query;

      if (!VALID_ENTITY_TYPES.includes(entityType as ImageEntityType)) {
        res.status(400).json({
          success: false,
          error: `entity_type must be one of: ${VALID_ENTITY_TYPES.join(', ')}`,
          status_code: 400,
          timestamp: new Date(),
        });
        return;
      }

      const images = await this.imageService.listImagesByEntity(
        storeId,
        entityType as ImageEntityType,
        entity_id as string | undefined
      );
      res.json({ success: true, data: images });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async updateImage(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user.store_id;
      const { id } = req.params;
      const data: UpdateImageRequest = req.body;
      const image = await this.imageService.updateImage(id, storeId, data);
      res.json({ success: true, data: image, message: 'Image updated successfully' });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async deleteImage(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user.store_id;
      const { id } = req.params;
      await this.imageService.deleteImage(id, storeId);
      res.json({ success: true, message: 'Image deleted successfully' });
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
