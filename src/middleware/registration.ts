import { Request, Response, NextFunction } from 'express';

/**
 * Public store sign-up is open by default (development). In production set
 * ALLOW_PUBLIC_REGISTRATION=false once the first store is created, so only people you let in
 * (by re-opening it for a moment) can create a store.
 */
export const registrationOpen = (): boolean => (process.env.ALLOW_PUBLIC_REGISTRATION ?? 'true').trim().toLowerCase() !== 'false';

export const requireRegistrationOpen = (_req: Request, res: Response, next: NextFunction) => {
  if (registrationOpen()) return next();
  return res.status(403).json({ success: false, error: 'Registration is closed', status_code: 403 });
};
