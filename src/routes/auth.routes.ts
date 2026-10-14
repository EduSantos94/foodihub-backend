import { Router } from 'express';
import { AuthController } from '../controllers/AuthController.js';
import { rateLimit } from '../middleware/rateLimit.js';

const router = Router();
const authController = new AuthController();

const emailOf = (body: any): string => String(body?.email ?? '').trim().toLowerCase();

// Brute-force protection: attempts per IP+email, and a looser cap per IP alone
const loginPerAccount = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  key: (req) => `${req.ip}|${emailOf(req.body)}`,
  message: 'Too many login attempts. Try again in a few minutes.',
});
const loginPerIp = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  key: (req) => req.ip ?? 'unknown',
  message: 'Too many login attempts. Try again in a few minutes.',
});
const registerPerIp = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  key: (req) => req.ip ?? 'unknown',
  message: 'Too many registrations from this address. Try again later.',
});

/**
 * POST /auth/login
 * Autenticar usuário
 */
router.post('/login', loginPerIp, loginPerAccount, (req, res) => authController.login(req, res));

/**
 * POST /auth/register
 * Cadastrar uma nova loja (por CNPJ) com o primeiro usuário administrador
 */
router.post('/register', registerPerIp, (req, res) => authController.register(req, res));

export default router;
