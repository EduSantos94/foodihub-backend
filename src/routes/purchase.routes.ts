import express, { Router } from 'express';
import { PurchaseController } from '../controllers/PurchaseController.js';
import { importHandler } from '../controllers/importHandler.js';
import { PurchaseService } from '../services/PurchaseService.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';

const router = Router();
const controller = new PurchaseController();
const service = new PurchaseService();

router.use(authenticateToken);

// GET /api/purchases - list purchases (paginated)
router.get('/', (req, res) => controller.listPurchases(req, res));

// POST /api/purchases - create purchase with items
router.post('/', (req, res) => controller.createPurchase(req, res));

// POST /api/purchases/import-history - import the purchases history from a spreadsheet. It never changes stock.
router.post(
  '/import-history',
  authorizeRole('admin', 'manager'),
  express.json({ limit: '5mb' }),
  importHandler((storeId, body) =>
    service.importPurchaseHistory(storeId, body.rows, {
      dry_run: body.dry_run === true,
      default_date: typeof body.default_date === 'string' ? body.default_date : undefined,
      create_missing_suppliers: body.create_missing_suppliers,
      group_lines: body.group_lines,
    })
  )
);

// DELETE /api/purchases/import-history/:batchId - undo one import
router.delete('/import-history/:batchId', authorizeRole('admin', 'manager'), async (req, res) => {
  try {
    const data = await service.undoPurchaseHistory((req as any).user.store_id, req.params.batchId);
    res.json({ success: true, data, message: 'Import undone' });
  } catch (error: any) {
    const status = String(error.message).includes('not found') ? 404 : 400;
    res.status(status).json({ success: false, error: error.message, status_code: status, timestamp: new Date() });
  }
});

// GET /api/purchases/:id - get purchase with items
router.get('/:id', (req, res) => controller.getPurchase(req, res));

// PUT /api/purchases/:id - update purchase (status, payment, etc)
router.put('/:id', (req, res) => controller.updatePurchase(req, res));

// DELETE /api/purchases/:id - delete purchase and take its quantities out of stock (admin/manager only)
router.delete('/:id', authorizeRole('admin', 'manager'), (req, res) => controller.deletePurchase(req, res));

export { router as purchaseRoutes };
