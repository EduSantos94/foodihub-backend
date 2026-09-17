import { Router } from 'express';
import { CategoryController } from '../controllers/CategoryController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
const controller = new CategoryController();

// All category routes require authentication
router.use(authenticateToken);

// List categories
router.get('/', (req, res) => controller.listCategories(req, res));

// Create category (admin only)
router.post('/', (req, res) => controller.createCategory(req, res));

// Get category by id
router.get('/:id', (req, res) => controller.getCategory(req, res));

// Update category (admin only)
router.put('/:id', (req, res) => controller.updateCategory(req, res));

// Delete category (admin only)
router.delete('/:id', (req, res) => controller.deleteCategory(req, res));

export { router as categoryRoutes };
