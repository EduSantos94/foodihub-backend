import { Router } from 'express';
import { SupplyController } from '../controllers/SupplyController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
const controller = new SupplyController();

router.use(authenticateToken);

router.get('/', (req, res) => controller.listSupplies(req, res));
router.post('/', (req, res) => controller.createSupply(req, res));
router.get('/:id', (req, res) => controller.getSupply(req, res));
router.put('/:id', (req, res) => controller.updateSupply(req, res));
router.delete('/:id', (req, res) => controller.deleteSupply(req, res));

export { router as supplyRoutes };
