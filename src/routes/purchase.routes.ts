import { Router } from 'express';
import { PurchaseController } from '../controllers/PurchaseController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
const controller = new PurchaseController();

router.use(authenticateToken);

// GET /api/purchases - list purchases (paginated)
router.get('/', (req, res) => controller.listPurchases(req, res));

// POST /api/purchases - create purchase with items
router.post('/', (req, res) => controller.createPurchase(req, res));

// GET /api/purchases/:id - get purchase with items
router.get('/:id', (req, res) => controller.getPurchase(req, res));

// PUT /api/purchases/:id - update purchase (status, payment, etc)
router.put('/:id', (req, res) => controller.updatePurchase(req, res));

// DELETE /api/purchases/:id - delete purchase
router.delete('/:id', (req, res) => controller.deletePurchase(req, res));

export { router as purchaseRoutes };
