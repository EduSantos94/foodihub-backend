import { Request, Response, NextFunction } from 'express';

interface Options {
  windowMs: number;
  max: number;
  /** What is counted: usually the IP, plus the email for logins */
  key: (req: Request) => string;
  message?: string;
}

/**
 * Small fixed-window, in-memory limiter against brute force (login) and sign-up abuse.
 * It is per process: behind several instances each one counts on its own.
 */
export function rateLimit({ windowMs, max, key, message = 'Too many attempts. Try again later.' }: Options) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
  }, Math.min(windowMs, 60_000));
  sweep.unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const k = key(req);
    const entry = hits.get(k);

    if (!entry || entry.resetAt <= now) {
      hits.set(k, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count += 1;
    if (entry.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ success: false, error: message, status_code: 429 });
    }
    next();
  };
}
