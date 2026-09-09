import { Router } from 'express';
import { AuthController } from '../controllers/AuthController.js';

const router = Router();
const authController = new AuthController();

/**
 * POST /auth/login
 * Login de usuário
 */
router.post('/login', (req, res) => authController.login(req, res));

/**
 * POST /auth/register
 * Registro de nova loja e admin
 */
router.post('/register', (req, res) => authController.register(req, res));

export default router;
