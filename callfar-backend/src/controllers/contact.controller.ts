import { Response, NextFunction } from 'express';
import { ContactService } from '../services/contact.service.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';

export class ContactController {
  static async getContacts(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const contacts = await ContactService.getContacts(userId);
      res.status(200).json({ success: true, data: contacts });
    } catch (err) {
      next(err);
    }
  }

  static async sendRequest(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const senderId = req.user!.userId;
      const { receiver } = req.body;
      const request = await ContactService.sendRequest(senderId, receiver);
      res.status(201).json({ success: true, message: 'Contact request sent.', data: request });
    } catch (err) {
      next(err);
    }
  }

  static async getRequests(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const requests = await ContactService.getPendingRequests(userId);
      res.status(200).json({ success: true, data: requests });
    } catch (err) {
      next(err);
    }
  }

  static async acceptRequest(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { requestId } = req.params;
      const result = await ContactService.acceptRequest(userId, requestId);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async rejectRequest(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { requestId } = req.params;
      const result = await ContactService.rejectRequest(userId, requestId);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async removeContact(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { contactUserId } = req.params;
      const result = await ContactService.removeContact(userId, contactUserId);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async blockUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const blockerId = req.user!.userId;
      const { userIdToBlock } = req.body;
      const result = await ContactService.blockUser(blockerId, userIdToBlock);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async unblockUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const blockerId = req.user!.userId;
      const { blockedId } = req.params;
      const result = await ContactService.unblockUser(blockerId, blockedId);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async getBlockedUsers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const list = await ContactService.getBlockedUsers(userId);
      res.status(200).json({ success: true, data: list });
    } catch (err) {
      next(err);
    }
  }
}
