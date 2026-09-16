import { Request, Response } from 'express';
import { ProductService } from '../services/ProductService.js';
import {
  CreateProductRequest,
  UpdateProductRequest,
  CreateProductSizeRequest,
  UpdateProductSizeRequest,
  PaginationQuery,
} from '../types/index.js';

export class ProductController {
  private productService: ProductService;

  constructor() {
    this.productService = new ProductService();
  }

  // ==================== Products ====================

  async createProduct(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user.store_id;
      const data: CreateProductRequest = req.body;

      if (!data.name || data.price === undefined) {
        res.status(400).json({
          success: false,
          error: 'name and price are required',
          status_code: 400,
          timestamp: new Date(),
        });
        return;
      }

      const product = await this.productService.createProduct(storeId, data);
      res.status(201).json({
        success: true,
        data: product,
        message: 'Product created successfully',
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getProduct(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user.store_id;
      const { id } = req.params;

      const product = await this.productService.getProduct(id, storeId);
      res.json({
        success: true,
        data: product,
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async listProducts(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user.store_id;
      const query: PaginationQuery = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
      };

      const products = await this.productService.listProducts(storeId, query);
      res.json({
        success: true,
        data: products.data,
        pagination: products.pagination,
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async updateProduct(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user.store_id;
      const { id } = req.params;
      const data: UpdateProductRequest = req.body;

      const product = await this.productService.updateProduct(id, storeId, data);
      res.json({
        success: true,
        data: product,
        message: 'Product updated successfully',
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async deleteProduct(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user.store_id;
      const { id } = req.params;

      await this.productService.deleteProduct(id, storeId);
      res.json({
        success: true,
        message: 'Product deleted successfully',
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  // ==================== Sizes ====================

  async addSize(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user.store_id;
      const { productId } = req.params;
      const data: CreateProductSizeRequest = req.body;

      if (!data.name) {
        res.status(400).json({
          success: false,
          error: 'name is required',
          status_code: 400,
          timestamp: new Date(),
        });
        return;
      }

      const size = await this.productService.addSize(productId, storeId, data);
      res.status(201).json({
        success: true,
        data: size,
        message: 'Size added successfully',
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async listSizes(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user.store_id;
      const { productId } = req.params;

      const sizes = await this.productService.listSizes(productId, storeId);
      res.json({
        success: true,
        data: sizes,
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async updateSize(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user.store_id;
      const { productId, sizeId } = req.params;
      const data: UpdateProductSizeRequest = req.body;

      const size = await this.productService.updateSize(sizeId, productId, storeId, data);
      res.json({
        success: true,
        data: size,
        message: 'Size updated successfully',
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async deleteSize(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user.store_id;
      const { productId, sizeId } = req.params;

      await this.productService.deleteSize(sizeId, productId, storeId);
      res.json({
        success: true,
        message: 'Size deleted successfully',
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
