import { Router } from 'express';
import { SupplyController } from '../controllers/SupplyController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
const controller = new SupplyController();

router.use(authenticateToken);

// GET /api/supplies - list supplies (paginated)
router.get('/', (req, res) => controller.listSupplies(req, res));

// POST /api/supplies - create supply
router.post('/', (req, res) => controller.createSupply(req, res));

// GET /api/supplies/:id - get single supply
router.get('/:id', (req, res) => controller.getSupply(req, res));

// PUT /api/supplies/:id - update supply
router.put('/:id', (req, res) => controller.updateSupply(req, res));

// DELETE /api/supplies/:id - delete supply
router.delete('/:id', (req, res) => controller.deleteSupply(req, res));

export { router as supplyRoutes };
