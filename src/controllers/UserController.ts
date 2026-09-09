import { Request, Response } from 'express';
import { UserService } from '../services/UserService.js';
import {
  CreateUserRequest,
  UpdateUserRequest,
  ChangePasswordRequest,
  PaginationQuery,
} from '../types/index.js';

export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  async createUser(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user?.store_id;
      if (!storeId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          status_code: 401,
        });
        return;
      }

      const data: CreateUserRequest = req.body;
      const user = await this.userService.createUser(storeId, data);
      res.status(201).json({
        success: true,
        data: user,
        message: 'User created successfully',
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getUser(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const user = await this.userService.getUserById(id);
      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async updateUser(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const data: UpdateUserRequest = req.body;
      const user = await this.userService.updateUser(id, data);
      res.json({
        success: true,
        data: user,
        message: 'User updated successfully',
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async changePassword(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const data: ChangePasswordRequest = req.body;
      await this.userService.changePassword(id, data);
      res.json({
        success: true,
        message: 'Password changed successfully',
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getUsersByStore(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user?.store_id;
      if (!storeId) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          status_code: 401,
        });
        return;
      }

      const query: PaginationQuery = {
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
        order: (req.query.order as 'ASC' | 'DESC') || 'DESC',
      };

      const users = await this.userService.getUsersByStore(storeId, query);
      res.json({
        success: true,
        data: users,
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async deactivateUser(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const user = await this.userService.deactivateUser(id);
      res.json({
        success: true,
        data: user,
        message: 'User deactivated successfully',
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
