import express, { Router } from 'express';
import { ProductController } from '../controllers/ProductController.js';
import { importHandler } from '../controllers/importHandler.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';
import { ProductService } from '../services/ProductService.js';

const router = Router();
const controller = new ProductController();
const service = new ProductService();

// Apply auth middleware to all routes
router.use(authenticateToken);

// ==================== Products ====================

/**
 * POST /api/products
 * Create new product
 */
router.post('/', (req, res) => controller.createProduct(req, res));

/**
 * GET /api/products
 * List products with pagination
 */
router.get('/', (req, res) => controller.listProducts(req, res));

/**
 * POST /api/products/import
 * Import products (price and opening stock) from a spreadsheet. Admin/manager only.
 */
router.post('/import', authorizeRole('admin', 'manager'), express.json({ limit: '5mb' }), importHandler((storeId, body) => service.importProducts(storeId, body.rows, { dry_run: body.dry_run === true, default_amount: body.default_amount === undefined || body.default_amount === '' ? undefined : Number(body.default_amount) })));

/**
 * GET /api/products/:id
 * Get product by ID
 */
router.get('/:id', (req, res) => controller.getProduct(req, res));

/**
 * PUT /api/products/:id
 * Update product
 */
router.put('/:id', (req, res) => controller.updateProduct(req, res));

/**
 * DELETE /api/products/:id
 * Delete product
 */
router.delete('/:id', (req, res) => controller.deleteProduct(req, res));

// ==================== Sizes ====================

/**
 * POST /api/products/:productId/sizes
 * Add size to product
 */
router.post('/:productId/sizes', (req, res) => controller.addSize(req, res));

/**
 * GET /api/products/:productId/sizes
 * List sizes for product
 */
router.get('/:productId/sizes', (req, res) => controller.listSizes(req, res));

/**
 * PUT /api/products/:productId/sizes/:sizeId
 * Update size
 */
router.put('/:productId/sizes/:sizeId', (req, res) => controller.updateSize(req, res));

/**
 * DELETE /api/products/:productId/sizes/:sizeId
 * Delete size
 */
router.delete('/:productId/sizes/:sizeId', (req, res) => controller.deleteSize(req, res));

export default router;
