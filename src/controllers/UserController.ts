import { Request, Response } from 'express';
import { UserService } from '../services/UserService.js';
import { invalidateAuthCache } from '../middleware/auth.js';
import {
  CreateUserRequest,
  UpdateUserRequest,
  ChangePasswordRequest,
  PaginationQuery,
} from '../types/index.js';

/**
 * Users are always handled inside the logged user's own store:
 *  - admin: creates users, edits and deactivates anyone in the store (not themselves)
 *  - manager: lists the store's users
 *  - everyone: sees and edits their own profile and changes their own password
 * A user id from another store is always answered with 404.
 */
export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  async createUser(req: Request, res: Response): Promise<void> {
    try {
      const { store_id: storeId } = (req as any).user;
      const data: CreateUserRequest = req.body;
      // store_id always comes from the token, never from the body
      const user = await this.userService.createUser(storeId, {
        email: data.email,
        password: data.password,
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone,
        role: data.role,
      });
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
      const { store_id: storeId, id: me, role } = (req as any).user;
      const { id } = req.params;

      // staff only sees themselves; admin/manager see the whole store
      if (id !== me && !['admin', 'manager'].includes(role)) {
        this.notFound(res);
        return;
      }

      const user = await this.userService.getUserById(id, storeId);
      res.json({ success: true, data: user });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async updateUser(req: Request, res: Response): Promise<void> {
    try {
      const { store_id: storeId, id: me, role } = (req as any).user;
      const { id } = req.params;
      const body: UpdateUserRequest = req.body ?? {};

      if (id !== me && role !== 'admin') {
        this.notFound(res);
        return;
      }

      // Only these fields are editable. `active` is an admin decision about someone else.
      const data: UpdateUserRequest = {
        first_name: body.first_name,
        last_name: body.last_name,
        phone: body.phone,
      };
      if (body.active !== undefined) {
        if (role !== 'admin' || id === me) {
          res.status(403).json({ success: false, error: 'Insufficient permissions', status_code: 403, timestamp: new Date() });
          return;
        }
        data.active = body.active;
      }

      const user = await this.userService.updateUser(id, storeId, data);
      if (data.active === false) invalidateAuthCache(id);
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
      const { id: me } = (req as any).user;
      const { id } = req.params;

      // Passwords can only be changed by their owner
      if (id !== me) {
        this.notFound(res);
        return;
      }

      const body: ChangePasswordRequest = req.body ?? ({} as ChangePasswordRequest);
      await this.userService.changePassword(id, {
        current_password: body.current_password,
        new_password: body.new_password,
      });
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
      const { store_id: storeId } = (req as any).user;

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
      const { store_id: storeId, id: me } = (req as any).user;
      const { id } = req.params;

      if (id === me) {
        res.status(400).json({ success: false, error: 'You cannot deactivate your own account', status_code: 400, timestamp: new Date() });
        return;
      }

      const user = await this.userService.deactivateUser(id, storeId);
      invalidateAuthCache(id);
      res.json({
        success: true,
        data: user,
        message: 'User deactivated successfully',
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  private notFound(res: Response): void {
    res.status(404).json({ success: false, error: 'User not found', status_code: 404, timestamp: new Date() });
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
