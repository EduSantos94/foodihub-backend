import { Router } from 'express';
import { StoreController } from '../controllers/StoreController.js';
import { authenticateToken, authorizeRole, requireOwnStore } from '../middleware/auth.js';

const router = Router();
const storeController = new StoreController();

// Every store route requires login and only ever exposes the user's own store.
// New stores are created through POST /auth/register (store + first admin together).
router.use(authenticateToken);

/**
 * GET /stores
 * Returns the user's own store (same paginated shape as before, with a single item)
 */
router.get('/', (req, res) => storeController.getMyStore(req, res));

/**
 * GET /stores/:id
 * Obter dados da própria loja
 */
router.get('/:id', requireOwnStore, (req, res) => storeController.getStore(req, res));

/**
 * PUT /stores/:id
 * Atualizar a própria loja (admin)
 */
router.put('/:id', requireOwnStore, authorizeRole('admin'), (req, res) =>
  storeController.updateStore(req, res)
);

/**
 * PATCH /stores/:id/deactivate
 * Desativar a própria loja (admin)
 */
router.patch('/:id/deactivate', requireOwnStore, authorizeRole('admin'), (req, res) =>
  storeController.deactivateStore(req, res)
);

/**
 * DELETE /stores/:id
 * Deletar (soft delete) a própria loja (admin)
 */
router.delete('/:id', requireOwnStore, authorizeRole('admin'), (req, res) =>
  storeController.deleteStore(req, res)
);

export default router;
