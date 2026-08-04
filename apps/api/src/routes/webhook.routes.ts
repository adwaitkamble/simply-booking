import { Router } from 'express';
import { WebhookController } from '../controllers/webhook.controller.js';

export const webhookRouter = Router();

// Inbound OTA webhook endpoint
webhookRouter.post('/ota', WebhookController.handleOTAWebhook);

// Channel synchronization audit logs
webhookRouter.get('/logs', WebhookController.getChannelLogs);

// Channel distribution metrics
webhookRouter.get('/metrics', WebhookController.getChannelMetrics);
