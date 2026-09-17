import { Request, Response } from 'express';
import { CategoryService } from '../services/CategoryService.js';
import { CreateCategoryRequest, UpdateCategoryRequest, PaginationQuery } from '../types/index.js';

export class CategoryController {
  private categoryService: CategoryService;

  constructor() {
    this.categoryService = new CategoryService();
  }

  async createCategory(req: Request, res: Response): Promise<void> {
    try {
      const data: CreateCategoryRequest = req.body;

      if (!data.name) {
        res.status(400).json({
          success: false,
          error: 'name is required',
          status_code: 400,
          timestamp: new Date(),
        });
        return;
      }

      const category = await this.categoryService.createCategory(data);
      res.status(201).json({
        success: true,
        data: category,
        message: 'Category created successfully',
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getCategory(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const category = await this.categoryService.getCategory(id);
      res.json({
        success: true,
        data: category,
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async listCategories(req: Request, res: Response): Promise<void> {
    try {
      const query: PaginationQuery = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
      };

      const categories = await this.categoryService.listCategories(query);
      res.json({
        success: true,
        data: categories.data,
        pagination: categories.pagination,
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async updateCategory(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const data: UpdateCategoryRequest = req.body;

      const category = await this.categoryService.updateCategory(id, data);
      res.json({
        success: true,
        data: category,
        message: 'Category updated successfully',
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async deleteCategory(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      await this.categoryService.deleteCategory(id);
      res.json({
        success: true,
        message: 'Category deleted successfully',
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
