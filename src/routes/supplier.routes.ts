import express, { Router } from 'express';
import { SupplierController } from '../controllers/SupplierController.js';
import { importHandler } from '../controllers/importHandler.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { SupplierService } from '../services/SupplierService.js';

const router = Router();
const controller = new SupplierController();
const service = new SupplierService();

router.use(authenticateToken);

router.get('/', (req, res) => controller.listSuppliers(req, res));
router.post('/', (req, res) => controller.createSupplier(req, res));
// Import suppliers from a spreadsheet (already read and mapped by the frontend). Admin/manager only.
// The bigger body limit applies here only, after login (server.ts skips the global parser for it).
router.post('/import', authorizeRole('admin', 'manager'), express.json({ limit: '5mb' }), importHandler((storeId, body) => service.importSuppliers(storeId, body.rows, { dry_run: body.dry_run === true })));

router.get('/:id', (req, res) => controller.getSupplier(req, res));
router.put('/:id', (req, res) => controller.updateSupplier(req, res));
router.delete('/:id', (req, res) => controller.deleteSupplier(req, res));

export { router as supplierRoutes };
