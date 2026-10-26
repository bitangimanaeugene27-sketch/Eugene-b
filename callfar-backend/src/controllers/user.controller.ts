import { Response, NextFunction } from 'express';
import { UserService } from '../services/user.service.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';

export class UserController {
  static async getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const user = await UserService.getProfile(userId);
      res.status(200).json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  }

  static async updateProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const updated = await UserService.updateProfile(userId, req.body);
      res.status(200).json({ success: true, message: 'Profile updated.', data: updated });
    } catch (err) {
      next(err);
    }
  }

  static async updateSettings(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const updated = await UserService.updateSettings(userId, req.body);
      res.status(200).json({ success: true, message: 'Settings updated.', data: updated });
    } catch (err) {
      next(err);
    }
  }

  static async changePassword(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        res.status(400).json({ success: false, message: 'currentPassword and newPassword are required.' });
        return;
      }
      await UserService.changePassword(userId, currentPassword, newPassword);
      res.status(200).json({ success: true, message: 'Password changed successfully. Please log in again on other devices.' });
    } catch (err) {
      next(err);
    }
  }

  static async changeEmail(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { newEmail, password } = req.body;
      if (!newEmail || !password) {
        res.status(400).json({ success: false, message: 'newEmail and password are required.' });
        return;
      }
      const updatedUser = await UserService.changeEmail(userId, newEmail, password);
      res.status(200).json({
        success: true,
        message: 'Email address updated successfully.',
        data: updatedUser,
      });
    } catch (err) {
      next(err);
    }
  }

  static async deleteAccount(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { password } = req.body;
      if (!password) {
        res.status(400).json({ success: false, message: 'Password is required to delete your account.' });
        return;
      }
      await UserService.deleteAccount(userId, password);
      res.status(200).json({ success: true, message: 'Account deleted.' });
    } catch (err) {
      next(err);
    }
  }

  static async searchUsers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = (req.query.q as string) || '';
      const currentUserId = req.user!.userId;
      const results = await UserService.searchUsers(query, currentUserId);
      res.status(200).json({ success: true, data: results });
    } catch (err) {
      next(err);
    }
  }
}
