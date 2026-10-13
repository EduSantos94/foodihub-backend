import { Router } from 'express';
import { SaleController } from '../controllers/SaleController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
const controller = new SaleController();

router.use(authenticateToken);

// GET /api/sales - list sales (paginated, optional ?status=)
router.get('/', (req, res) => controller.listSales(req, res));

// POST /api/sales - create sale with items (decrements products.amount)
router.post('/', (req, res) => controller.createSale(req, res));

// GET /api/sales/:id - get sale with items
router.get('/:id', (req, res) => controller.getSale(req, res));

// PUT /api/sales/:id - update status, payment, notes (status=cancelled restores stock)
router.put('/:id', (req, res) => controller.updateSale(req, res));

// POST /api/sales/:id/cancel - cancel sale and restore stock
router.post('/:id/cancel', (req, res) => controller.cancelSale(req, res));

export { router as saleRoutes };
