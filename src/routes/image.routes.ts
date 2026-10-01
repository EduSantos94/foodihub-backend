import { Router } from 'express';
import { ImageController } from '../controllers/ImageController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
const controller = new ImageController();

router.use(authenticateToken);

// GET /api/images - list all images (paginated)
router.get('/', (req, res) => controller.listImages(req, res));

// GET /api/images/entity/:entityType?entity_id=xxx - list by entity type
router.get('/entity/:entityType', (req, res) => controller.listImagesByEntity(req, res));

// POST /api/images - create image record
router.post('/', (req, res) => controller.createImage(req, res));

// GET /api/images/:id - get single image
router.get('/:id', (req, res) => controller.getImage(req, res));

// PUT /api/images/:id - update image
router.put('/:id', (req, res) => controller.updateImage(req, res));

// DELETE /api/images/:id - delete image
router.delete('/:id', (req, res) => controller.deleteImage(req, res));

export { router as imageRoutes };
