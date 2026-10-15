import { Request, Response } from 'express';
import { ReportService } from '../services/ReportService.js';

export class ReportController {
  private reportService = new ReportService();

  async overview(req: Request, res: Response): Promise<void> {
    try {
      const storeId = (req as any).user.store_id;
      const data = await this.reportService.overview(storeId);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error',
        status_code: 500,
        timestamp: new Date(),
      });
    }
  }
}
