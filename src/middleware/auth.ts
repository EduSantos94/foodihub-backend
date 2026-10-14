import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService.js';
import { createDataSource } from '../database/connection.js';
import { UserModel } from '../database/models/UserModel.js';

export interface AuthRequest extends Request {
  user?: Record<string, any>;
}

const authService = new AuthService();

// A token stays cryptographically valid for 24h, but the account behind it may have been
// deactivated meanwhile (user, or the whole store). The state is looked up in the database and
// cached briefly so a deactivation applies within seconds without one query per request.
const AUTH_CACHE_TTL_MS = 15_000;
const authCache = new Map<string, { active: boolean; until: number }>();

/** Forget the cached state of one user (after deactivating them) or of everybody. */
export const invalidateAuthCache = (userId?: string): void => {
  if (userId) authCache.delete(userId);
  else authCache.clear();
};

async function isAccountActive(userId: string): Promise<boolean> {
  const cached = authCache.get(userId);
  if (cached && cached.until > Date.now()) return cached.active;

  const ds = await createDataSource();
  const rows = await ds.query(
    `SELECT u.active AS user_active, s.active AS store_active, s.deleted_at AS store_deleted
       FROM users u JOIN stores s ON s.id = u.store_id
      WHERE u.id = $1 AND u.deleted_at IS NULL`,
    [userId]
  );
  const row = rows[0];
  const active = !!row && row.user_active === true && row.store_active !== false && row.store_deleted === null;

  authCache.set(userId, { active, until: Date.now() + AUTH_CACHE_TTL_MS });
  return active;
}

/**
 * Middleware para autenticar token JWT
 * Adiciona dados do usuário ao objeto req
 */
export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  let decoded: Record<string, any>;

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

    decoded = authService.verifyToken(token);
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unauthorized',
      status_code: 401,
    });
  }

  try {
    if (!decoded.id || !(await isAccountActive(decoded.id))) {
      return res.status(401).json({
        success: false,
        error: 'Account is inactive or no longer exists',
        status_code: 401,
      });
    }
  } catch {
    // Fail closed: if the account cannot be verified, the request is not authenticated
    return res.status(503).json({
      success: false,
      error: 'Authentication is temporarily unavailable',
      status_code: 503,
    });
  }

  (req as any).user = decoded;
  next();
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

/**
 * Restricts /:id routes to the user's own store. Answers 404 (not 403) for any other
 * id so the existence of other tenants' stores is not revealed.
 */
export const requireOwnStore = (req: AuthRequest, res: Response, next: NextFunction) => {
  const user = (req as any).user;

  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'User not authenticated',
      status_code: 401,
    });
  }

  if (req.params.id !== user.store_id) {
    return res.status(404).json({
      success: false,
      error: 'Store not found',
      status_code: 404,
    });
  }

  next();
};

/**
 * Only platform administrators (users.is_platform_admin). Checked against the database on every
 * call, not from the token, so revoking the flag (or deactivating the user) applies immediately.
 */
export const requirePlatformAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const user = (req as any).user;

  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'User not authenticated',
      status_code: 401,
    });
  }

  try {
    const ds = await createDataSource();
    const record = await ds.getRepository(UserModel).findOne({
      where: { id: user.id, active: true },
      select: ['id', 'is_platform_admin'],
    });

    if (!record || record.is_platform_admin !== true) {
      return res.status(403).json({
        success: false,
        error: 'Only platform administrators can do this',
        status_code: 403,
      });
    }

    next();
  } catch {
    return res.status(500).json({
      success: false,
      error: 'Authorization error',
      status_code: 500,
    });
  }
};
