import { Router } from 'express';
import { authRouter } from './auth.routes.js';
import { roomRouter } from './room.routes.js';
import { propertyRouter } from './property.routes.js';
import { reservationRouter } from './reservation.routes.js';
import { invoiceRouter } from './invoice.routes.js';
import { webhookRouter } from './webhook.routes.js';
import { teamRouter } from './team.routes.js';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/rooms', roomRouter);
apiRouter.use('/properties', propertyRouter);
apiRouter.use('/reservations', reservationRouter);
apiRouter.use('/bookings', reservationRouter);
apiRouter.use('/invoices', invoiceRouter);
apiRouter.use('/webhooks', webhookRouter);
apiRouter.use('/team', teamRouter);
