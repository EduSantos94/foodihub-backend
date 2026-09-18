import { Router } from 'express';
import { CustomerController } from '../controllers/CustomerController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
const controller = new CustomerController();

// All customer routes require authentication
router.use(authenticateToken);

// List customers
router.get('/', (req, res) => controller.listCustomers(req, res));

// Create customer
router.post('/', (req, res) => controller.createCustomer(req, res));

// Get customer by id
router.get('/:id', (req, res) => controller.getCustomer(req, res));

// Update customer
router.put('/:id', (req, res) => controller.updateCustomer(req, res));

// Delete customer
router.delete('/:id', (req, res) => controller.deleteCustomer(req, res));

export { router as customerRoutes };
