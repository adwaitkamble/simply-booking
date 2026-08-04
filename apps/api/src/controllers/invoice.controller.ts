import { Request, Response, NextFunction } from 'express';
import { InvoiceService } from '../services/invoice.service.js';

export class InvoiceController {
  /**
   * POST /api/invoices/generate
   * Body: { reservationId: string, ancillaryItems?: AncillaryItemInput[] }
   */
  static async generateInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      const { reservationId, ancillaryItems } = req.body;

      if (!reservationId) {
        return res.status(400).json({
          success: false,
          error: 'Field "reservationId" is required to generate invoice',
        });
      }

      const invoice = await InvoiceService.generateInvoice({
        reservationId,
        ancillaryItems,
      });

      res.status(201).json({
        success: true,
        message: 'Invoice generated successfully with dynamic tax and ancillary charges',
        data: invoice,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/invoices/:id
   */
  static async getInvoiceById(req: Request, res: Response, next: NextFunction) {
    try {
      const invoiceId = req.params.id as string;
      const invoice = await InvoiceService.getInvoiceById(invoiceId);

      res.json({
        success: true,
        data: invoice,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/invoices/reservation/:reservationId
   */
  static async getInvoiceByReservation(req: Request, res: Response, next: NextFunction) {
    try {
      const reservationId = req.params.reservationId as string;
      const invoice = await InvoiceService.getInvoiceByReservationId(reservationId);

      if (!invoice) {
        return res.status(404).json({
          success: false,
          error: `No invoice found for reservation ${reservationId}`,
        });
      }

      res.json({
        success: true,
        data: invoice,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/invoices/:id/pay
   */
  static async payInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      const invoiceId = req.params.id as string;
      const result = await InvoiceService.payInvoice(invoiceId);

      res.json({
        success: true,
        message: 'Invoice paid successfully and checkout finalized',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
