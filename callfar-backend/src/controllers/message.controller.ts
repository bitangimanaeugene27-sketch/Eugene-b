import { Response, NextFunction } from 'express';
import { MessageService } from '../services/message.service.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';

export class MessageController {
  static async getConversations(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const conversations = await MessageService.getUserConversations(userId);
      res.status(200).json({ success: true, data: conversations });
    } catch (err) {
      next(err);
    }
  }

  static async getOrCreateDirectConversation(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { targetUserId } = req.body;
      const conversation = await MessageService.getOrCreateDirectConversation(userId, targetUserId);
      res.status(200).json({ success: true, data: conversation });
    } catch (err) {
      next(err);
    }
  }

  static async getMessages(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { conversationId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const cursor = req.query.cursor as string | undefined;

      const messages = await MessageService.getMessages(conversationId, userId, limit, cursor);
      res.status(200).json({ success: true, data: messages });
    } catch (err) {
      next(err);
    }
  }

  static async sendMessage(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { conversationId } = req.params;
      const { content } = req.body;

      if (!content || !content.trim()) {
        res.status(400).json({ success: false, message: 'Message content cannot be empty.' });
        return;
      }

      const message = await MessageService.sendMessage(conversationId, userId, content);
      res.status(201).json({ success: true, data: message });
    } catch (err) {
      next(err);
    }
  }

  static async markRead(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { conversationId } = req.params;
      await MessageService.markAsRead(conversationId, userId);
      res.status(200).json({ success: true });
    } catch (err) {
      next(err);
    }
  }
}
