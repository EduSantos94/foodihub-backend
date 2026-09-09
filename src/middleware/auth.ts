import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService.js';

export interface AuthRequest extends Request {
  user?: Record<string, any>;
}

const authService = new AuthService();

/**
 * Middleware para autenticar token JWT
 * Adiciona dados do usuário ao objeto req
 */
export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: 'Missing authorization header',
        status_code: 401,
      });
    }

    const [bearer, token] = authHeader.split(' ');

    if (bearer !== 'Bearer' || !token) {
      return res.status(401).json({
        success: false,
        error: 'Invalid authorization format',
        status_code: 401,
      });
    }

    const decoded = authService.verifyToken(token);
    (req as any).user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unauthorized',
      status_code: 401,
    });
  }
};

/**
 * Middleware para verificar permissões por role
 */
export const authorizeRole = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated',
          status_code: 401,
        });
      }

      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          status_code: 403,
        });
      }

      next();
    } catch (error) {
      return res.status(403).json({
        success: false,
        error: 'Authorization error',
        status_code: 403,
      });
    }
  };
};
