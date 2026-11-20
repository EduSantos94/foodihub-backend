import express, { Router } from 'express';
import { SupplyController } from '../controllers/SupplyController.js';
import { importHandler } from '../controllers/importHandler.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { SupplyService } from '../services/SupplyService.js';

const router = Router();
const controller = new SupplyController();
const service = new SupplyService();

router.use(authenticateToken);

// GET /api/supplies - list supplies (paginated)
router.get('/', (req, res) => controller.listSupplies(req, res));

// POST /api/supplies - create supply
router.post('/', (req, res) => controller.createSupply(req, res));

// POST /api/supplies/import - import supplies (with opening stock) from a spreadsheet (admin/manager only)
router.post('/import', authorizeRole('admin', 'manager'), express.json({ limit: '5mb' }), importHandler((storeId, body) => service.importSupplies(storeId, body.rows, { dry_run: body.dry_run === true })));

// GET /api/supplies/:id - get single supply
router.get('/:id', (req, res) => controller.getSupply(req, res));

// PUT /api/supplies/:id - update supply
router.put('/:id', (req, res) => controller.updateSupply(req, res));

// DELETE /api/supplies/:id - delete supply
router.delete('/:id', (req, res) => controller.deleteSupply(req, res));

export { router as supplyRoutes };
