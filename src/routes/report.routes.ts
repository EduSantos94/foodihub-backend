import { Router } from 'express';
import { ReportController } from '../controllers/ReportController.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';

const router = Router();
const controller = new ReportController();

// Revenue and margins are for admin/manager only
router.use(authenticateToken, authorizeRole('admin', 'manager'));

// GET /api/reports/overview - sales, top products, stock and integration health (last 30 days)
router.get('/overview', (req, res) => controller.overview(req, res));

export { router as reportRoutes };
