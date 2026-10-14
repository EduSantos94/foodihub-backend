import { Router } from 'express';
import { CategoryController } from '../controllers/CategoryController.js';
import { authenticateToken, requirePlatformAdmin } from '../middleware/auth.js';

const router = Router();
const controller = new CategoryController();

// All category routes require authentication
router.use(authenticateToken);

// List categories (every store only selects from these)
router.get('/', (req, res) => controller.listCategories(req, res));

// Create category (platform admin only)
router.post('/', requirePlatformAdmin, (req, res) => controller.createCategory(req, res));

// Get category by id
router.get('/:id', (req, res) => controller.getCategory(req, res));

// Update category (platform admin only)
router.put('/:id', requirePlatformAdmin, (req, res) => controller.updateCategory(req, res));

// Delete category (platform admin only)
router.delete('/:id', requirePlatformAdmin, (req, res) => controller.deleteCategory(req, res));

export { router as categoryRoutes };
