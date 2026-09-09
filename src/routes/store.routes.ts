import { Router } from 'express';
import { StoreController } from '../controllers/StoreController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
const storeController = new StoreController();

/**
 * POST /stores
 * Criar nova loja
 */
router.post('/', (req, res) => storeController.createStore(req, res));

/**
 * GET /stores
 * Listar todas as lojas (com paginação)
 */
router.get('/', (req, res) => storeController.getAllStores(req, res));

/**
 * GET /stores/:id
 * Obter dados de uma loja específica
 */
router.get('/:id', (req, res) => storeController.getStore(req, res));

/**
 * PUT /stores/:id
 * Atualizar dados de uma loja (requer autenticação)
 */
router.put('/:id', authenticateToken, (req, res) =>
  storeController.updateStore(req, res)
);

/**
 * PATCH /stores/:id/deactivate
 * Desativar uma loja (requer autenticação)
 */
router.patch('/:id/deactivate', authenticateToken, (req, res) =>
  storeController.deactivateStore(req, res)
);

/**
 * DELETE /stores/:id
 * Deletar (soft delete) uma loja (requer autenticação)
 */
router.delete('/:id', authenticateToken, (req, res) =>
  storeController.deleteStore(req, res)
);

export default router;
