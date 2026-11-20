import { Request, Response } from 'express';
import { ImportResult } from '../services/importCommon.js';

/**
 * Express handler shared by every spreadsheet import route. `run` receives the store and the request
 * body ({ rows, dry_run, ...options }) and returns the import report.
 */
export function importHandler(run: (storeId: string, body: any) => Promise<ImportResult>) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const storeId = (req as any).user.store_id;
      const result = await run(storeId, req.body ?? {});
      res.status(result.dry_run ? 200 : 201).json({
        success: true,
        data: result,
        message: result.dry_run ? 'Import checked' : 'Import done',
      });
    } catch (error: any) {
      const message = error?.message || 'Internal server error';
      const status = message.includes('not found') ? 404 : 400;
      res.status(status).json({ success: false, error: message, status_code: status, timestamp: new Date() });
    }
  };
}
