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
 * Atualizar os dados de contato da própria loja (admin da loja)
 */
router.put('/:id', requireOwnStore, authorizeRole('admin'), (req, res) =>
  storeController.updateStore(req, res)
);

// Deactivating or deleting a store is up to the platform administrator: see admin.store.routes.ts

export default router;
