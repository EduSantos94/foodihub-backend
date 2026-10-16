import express, { Router } from 'express';
import { CustomerController } from '../controllers/CustomerController.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';

const router = Router();
const controller = new CustomerController();

// All customer routes require authentication
router.use(authenticateToken);

// List customers
router.get('/', (req, res) => controller.listCustomers(req, res));

// Create customer
router.post('/', (req, res) => controller.createCustomer(req, res));

// Import customers from a spreadsheet (already read and mapped by the frontend). Admin/manager only.
// The bigger body limit applies here only, and only after login (server.ts skips the global parser).
router.post('/import', authorizeRole('admin', 'manager'), express.json({ limit: '5mb' }), (req, res) => controller.importCustomers(req, res));

// Get customer by id
router.get('/:id', (req, res) => controller.getCustomer(req, res));

// Update customer
router.put('/:id', (req, res) => controller.updateCustomer(req, res));

// Delete customer
router.delete('/:id', (req, res) => controller.deleteCustomer(req, res));

export { router as customerRoutes };
