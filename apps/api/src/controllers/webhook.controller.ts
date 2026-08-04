import type { Request, Response } from 'express';
import { OTAAdapterService } from '../services/ota-adapter.service.js';
import { ChannelService } from '../services/channel.service.js';

export class WebhookController {
  /**
   * POST /api/webhooks/ota
   * Inbound OTA booking webhook endpoint
   */
  static async handleOTAWebhook(req: Request, res: Response): Promise<void> {
    try {
      const result = await OTAAdapterService.processInboundBooking(req.body);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err: any) {
      const statusCode = err.statusCode || 500;
      res.status(statusCode).json({
        success: false,
        error: err.message || 'Failed to process OTA webhook booking',
      });
    }
  }

  /**
   * GET /api/webhooks/logs
   * Fetch recent two-way channel sync logs
   */
  static async getChannelLogs(req: Request, res: Response): Promise<void> {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const logs = ChannelService.getSyncLogs(limit);
      res.status(200).json({
        success: true,
        data: logs,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err.message || 'Failed to fetch channel sync logs',
      });
    }
  }

  /**
   * GET /api/webhooks/metrics
   * Fetch Direct vs OTA distribution metrics
   */
  static async getChannelMetrics(req: Request, res: Response): Promise<void> {
    try {
      const metrics = await ChannelService.getChannelMetrics();
      res.status(200).json({
        success: true,
        data: metrics,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err.message || 'Failed to calculate channel metrics',
      });
    }
  }
}
