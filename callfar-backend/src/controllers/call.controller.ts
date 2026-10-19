import { Response, NextFunction } from 'express';
import { CallService } from '../services/call.service.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';

export class CallController {
  static async getIceServers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const servers = CallService.getIceServers();
      res.status(200).json({ success: true, data: servers });
    } catch (err) {
      next(err);
    }
  }

  static async initiateCall(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const initiatorId = req.user!.userId;
      const { receiverId, callType } = req.body;
      const call = await CallService.initiateCall(initiatorId, receiverId, callType);
      res.status(201).json({ success: true, data: call });
    } catch (err) {
      next(err);
    }
  }

  static async getHistory(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const history = await CallService.getCallHistory(userId);
      res.status(200).json({ success: true, data: history });
    } catch (err) {
      next(err);
    }
  }
}
