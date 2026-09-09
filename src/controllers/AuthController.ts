import { Request, Response } from 'express';
import { AuthService } from '../services/AuthService.js';
import { LoginRequest, RegisterRequest } from '../types/index.js';

export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  async login(req: Request, res: Response): Promise<void> {
    try {
      const data: LoginRequest = req.body;

      if (!data.email || !data.password) {
        res.status(400).json({
          success: false,
          error: 'Email and password are required',
          status_code: 400,
        });
        return;
      }

      const result = await this.authService.login(data);
      res.json({
        success: true,
        data: result,
        message: 'Login successful',
      });
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async register(req: Request, res: Response): Promise<void> {
    try {
      const data: RegisterRequest = req.body;

      // Validar campos obrigatórios
      const requiredFields = [
        'store_name',
        'store_email',
        'store_document',
        'admin_email',
        'admin_password',
        'admin_first_name',
        'admin_last_name',
      ];

      const missingFields = requiredFields.filter((field) => !data[field as keyof RegisterRequest]);
      if (missingFields.length > 0) {
        res.status(400).json({
          success: false,
          error: `Missing required fields: ${missingFields.join(', ')}`,
          status_code: 400,
        });
        return;
      }

      const result = await this.authService.register(data);
      res.status(201).json({
        success: true,
        data: result,
        message: 'Registration successful',
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
