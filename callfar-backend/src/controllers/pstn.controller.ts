import { Request, Response, NextFunction } from 'express';
import { PstnService } from '../services/pstn.service.js';
import { serializeActiveCall } from '../telecom/pstn-gateway.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';

export class PstnController {
  static async getCountries(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const countries = PstnService.getCountries();
      res.status(200).json({ success: true, data: countries });
    } catch (err) {
      next(err);
    }
  }

  static async detectCarrier(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { phoneNumber, country } = req.query;
      if (!phoneNumber || typeof phoneNumber !== 'string') {
        res.status(400).json({ success: false, message: 'phoneNumber query parameter is required.' });
        return;
      }
      const result = PstnService.detectPhoneNumber(phoneNumber, (country as string) || 'RW');
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async initiateCall(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { phoneNumber } = req.body;
      if (!phoneNumber) {
        res.status(400).json({ success: false, message: 'phoneNumber is required.' });
        return;
      }
      const call = await PstnService.initiateCall(userId, phoneNumber);
      res.status(201).json({
        success: true,
        message: `Call to ${call.carrierInfo.displayFormat} initiated via ${call.carrierInfo.carrierName}.`,
        data: serializeActiveCall(call),
      });
    } catch (err) {
      next(err);
    }
  }

  static async endCall(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { callId } = req.body;
      if (!callId) {
        res.status(400).json({ success: false, message: 'callId is required.' });
        return;
      }
      const summary = await PstnService.endCall(callId, userId);
      res.status(200).json({
        success: true,
        message: 'Call terminated successfully.',
        data: summary,
      });
    } catch (err) {
      next(err);
    }
  }

  static async sendDtmf(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { callId, digit } = req.body;
      if (!callId || !digit) {
        res.status(400).json({ success: false, message: 'callId and digit are required.' });
        return;
      }
      const sent = PstnService.sendDtmf(callId, digit);
      res.status(200).json({ success: sent });
    } catch (err) {
      next(err);
    }
  }

  static async getHistory(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const history = PstnService.getUserHistory(userId);
      res.status(200).json({ success: true, data: history });
    } catch (err) {
      next(err);
    }
  }

  static async getAdminLogs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const logs = PstnService.getAllLogs();
      res.status(200).json({ success: true, data: logs });
    } catch (err) {
      next(err);
    }
  }

  static async getGatewayConfig(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const config = PstnService.getGatewayConfig();
      res.status(200).json({ success: true, data: config });
    } catch (err) {
      next(err);
    }
  }

  static async updateGatewayConfig(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const updated = PstnService.updateGatewayConfig(req.body);
      res.status(200).json({
        success: true,
        message: 'Telecom Gateway settings updated successfully.',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }
}
