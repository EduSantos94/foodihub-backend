import express, { Router } from 'express';
import { SaleController } from '../controllers/SaleController.js';
import { importHandler } from '../controllers/importHandler.js';
import { SaleService } from '../services/SaleService.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';

const router = Router();
const controller = new SaleController();
const service = new SaleService();

router.use(authenticateToken);

// GET /api/sales - list sales (paginated, optional ?status=)
router.get('/', (req, res) => controller.listSales(req, res));

// POST /api/sales - create sale with items (decrements products.amount)
router.post('/', (req, res) => controller.createSale(req, res));

// POST /api/sales/import-history - import the sales history from a spreadsheet.
// It never changes product stock and never fires webhooks. Admin/manager only.
router.post(
  '/import-history',
  authorizeRole('admin', 'manager'),
  express.json({ limit: '5mb' }),
  importHandler((storeId, body) =>
    service.importSaleHistory(storeId, body.rows, {
      dry_run: body.dry_run === true,
      default_date: typeof body.default_date === 'string' ? body.default_date : undefined,
      create_missing_products: body.create_missing_products,
      group_lines: body.group_lines,
    })
  )
);

// DELETE /api/sales/import-history/:batchId - undo one import (admin/manager only)
router.delete('/import-history/:batchId', authorizeRole('admin', 'manager'), async (req, res) => {
  try {
    const data = await service.undoSaleHistory((req as any).user.store_id, req.params.batchId);
    res.json({ success: true, data, message: 'Import undone' });
  } catch (error: any) {
    const status = String(error.message).includes('not found') ? 404 : 400;
    res.status(status).json({ success: false, error: error.message, status_code: status, timestamp: new Date() });
  }
});

// GET /api/sales/:id - get sale with items
router.get('/:id', (req, res) => controller.getSale(req, res));

// PUT /api/sales/:id - update status, payment, notes (status=cancelled restores stock)
router.put('/:id', (req, res) => controller.updateSale(req, res));

// POST /api/sales/:id/cancel - cancel sale and restore stock (admin/manager only)
router.post('/:id/cancel', authorizeRole('admin', 'manager'), (req, res) => controller.cancelSale(req, res));

export { router as saleRoutes };
