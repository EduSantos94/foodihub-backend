import { Router } from 'express';
import { ImageController } from '../controllers/ImageController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
const controller = new ImageController();

router.use(authenticateToken);

router.get('/', (req, res) => controller.listImages(req, res));
router.post('/', (req, res) => controller.createImage(req, res));
router.get('/:id', (req, res) => controller.getImage(req, res));
router.put('/:id', (req, res) => controller.updateImage(req, res));
router.delete('/:id', (req, res) => controller.deleteImage(req, res));

export { router as imageRoutes };
