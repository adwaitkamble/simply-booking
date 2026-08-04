import { Router } from 'express';
import { InvoiceController } from '../controllers/invoice.controller.js';
import { authenticateUser } from '../middlewares/auth.middleware.js';

export const invoiceRouter = Router();

// Protect all invoice routes
invoiceRouter.use(authenticateUser);

// POST /api/invoices/generate - Generate invoice with room & ancillary charges + tax
invoiceRouter.post('/generate', InvoiceController.generateInvoice);

// GET /api/invoices/:id - Retrieve invoice details
invoiceRouter.get('/:id', InvoiceController.getInvoiceById);

// GET /api/invoices/reservation/:reservationId - Retrieve invoice by reservation
invoiceRouter.get('/reservation/:reservationId', InvoiceController.getInvoiceByReservation);

// PATCH /api/invoices/:id/pay - Pay invoice & complete checkout
invoiceRouter.patch('/:id/pay', InvoiceController.payInvoice);
