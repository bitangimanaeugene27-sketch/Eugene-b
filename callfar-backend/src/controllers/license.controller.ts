import { Response, NextFunction } from 'express';
import { LicenseService } from '../services/license.service.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';

export class LicenseController {
  static async getMyLicense(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const license = await LicenseService.getMyLicense(userId);
      res.status(200).json({ success: true, data: license });
    } catch (err) {
      next(err);
    }
  }

  static async redeemKey(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { key } = req.body;

      if (!key || typeof key !== 'string') {
        res.status(400).json({ success: false, message: 'License key is required.' });
        return;
      }

      const result = await LicenseService.redeemKey(userId, key);
      res.status(200).json({
        success: true,
        message: result.message,
        data: result.license,
      });
    } catch (err) {
      next(err);
    }
  }
}
