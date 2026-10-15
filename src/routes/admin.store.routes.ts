import { Router } from 'express';
import { StoreController } from '../controllers/StoreController.js';
import { authenticateToken, requirePlatformAdmin } from '../middleware/auth.js';

const router = Router();
const controller = new StoreController();

// Store management across tenants: platform administrators only
router.use(authenticateToken, requirePlatformAdmin);

router.get('/', (req, res) => controller.listStores(req, res));
router.put('/:id', (req, res) => controller.updateStore(req, res));
router.patch('/:id/activate', (req, res) => controller.activateStore(req, res));
router.patch('/:id/deactivate', (req, res) => controller.deactivateStore(req, res));
router.delete('/:id', (req, res) => controller.deleteStore(req, res));

export default router;
