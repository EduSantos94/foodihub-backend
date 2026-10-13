import { Router } from 'express';
import { IntegrationController } from '../controllers/IntegrationController.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';

const router = Router();
const controller = new IntegrationController();

// Integrations hold credentials and webhook settings: admin and manager only
router.use(authenticateToken, authorizeRole('admin', 'manager'));

// Integrations
router.get('/', (req, res) => controller.listIntegrations(req, res));
router.post('/', (req, res) => controller.createIntegration(req, res));
router.get('/:id', (req, res) => controller.getIntegration(req, res));
router.put('/:id', (req, res) => controller.updateIntegration(req, res));
router.delete('/:id', (req, res) => controller.deleteIntegration(req, res));

// Webhooks of an integration
router.get('/:id/webhooks', (req, res) => controller.listWebhooks(req, res));
router.post('/:id/webhooks', (req, res) => controller.createWebhook(req, res));
router.put('/:id/webhooks/:webhookId', (req, res) => controller.updateWebhook(req, res));
router.delete('/:id/webhooks/:webhookId', (req, res) => controller.deleteWebhook(req, res));

router.post('/:id/webhooks/:webhookId/test', (req, res) => controller.testWebhook(req, res));

// Webhook event log
router.get('/:id/events', (req, res) => controller.listEvents(req, res));
router.post('/:id/events/:eventId/retry', (req, res) => controller.retryEvent(req, res));

export { router as integrationRoutes };
