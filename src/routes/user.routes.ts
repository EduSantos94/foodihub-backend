import { Router } from 'express';
import { UserController } from '../controllers/UserController.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';

const router = Router();
const userController = new UserController();

// Everything here requires login and is limited to the user's own store
router.use(authenticateToken);

/**
 * POST /users
 * Criar usuário na própria loja (admin)
 */
router.post('/', authorizeRole('admin'), (req, res) => userController.createUser(req, res));

/**
 * GET /users
 * Listar usuários da própria loja (admin, manager)
 */
router.get('/', authorizeRole('admin', 'manager'), (req, res) => userController.getUsersByStore(req, res));

/**
 * GET /users/:id
 * Ver um usuário da própria loja (staff só vê a si mesmo)
 */
router.get('/:id', (req, res) => userController.getUser(req, res));

/**
 * PUT /users/:id
 * Atualizar o próprio perfil, ou qualquer usuário da loja (admin)
 */
router.put('/:id', (req, res) => userController.updateUser(req, res));

/**
 * POST /users/:id/change-password
 * Alterar a PRÓPRIA senha
 */
router.post('/:id/change-password', (req, res) => userController.changePassword(req, res));

/**
 * PATCH /users/:id/deactivate
 * Desativar outro usuário da loja (admin)
 */
router.patch('/:id/deactivate', authorizeRole('admin'), (req, res) => userController.deactivateUser(req, res));

export default router;
