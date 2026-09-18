import { Router } from 'express';
import { SupplierController } from '../controllers/SupplierController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
const controller = new SupplierController();

router.use(authenticateToken);

router.get('/', (req, res) => controller.listSuppliers(req, res));
router.post('/', (req, res) => controller.createSupplier(req, res));
router.get('/:id', (req, res) => controller.getSupplier(req, res));
router.put('/:id', (req, res) => controller.updateSupplier(req, res));
router.delete('/:id', (req, res) => controller.deleteSupplier(req, res));

export { router as supplierRoutes };
