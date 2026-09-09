import { Router } from 'express';
import { UserController } from '../controllers/UserController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
const userController = new UserController();

/**
 * POST /users
 * Criar novo usuário (requer autenticação)
 */
router.post('/', authenticateToken, (req, res) =>
  userController.createUser(req, res)
);

/**
 * GET /users
 * Listar usuários da loja autenticada (requer autenticação)
 */
router.get('/', authenticateToken, (req, res) =>
  userController.getUsersByStore(req, res)
);

/**
 * GET /users/:id
 * Obter dados de um usuário específico
 */
router.get('/:id', (req, res) => userController.getUser(req, res));

/**
 * PUT /users/:id
 * Atualizar dados de um usuário (requer autenticação)
 */
router.put('/:id', authenticateToken, (req, res) =>
  userController.updateUser(req, res)
);

/**
 * POST /users/:id/change-password
 * Alterar senha do usuário (requer autenticação)
 */
router.post('/:id/change-password', authenticateToken, (req, res) =>
  userController.changePassword(req, res)
);

/**
 * PATCH /users/:id/deactivate
 * Desativar um usuário (requer autenticação)
 */
router.patch('/:id/deactivate', authenticateToken, (req, res) =>
  userController.deactivateUser(req, res)
);

export default router;
