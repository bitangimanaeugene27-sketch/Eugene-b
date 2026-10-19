import { Response, NextFunction } from 'express';
import { AdminService } from '../services/admin.service.js';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { getSocketServer } from '../signaling/socket.server.js';

export class AdminController {
  static async getStats(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await AdminService.getSystemStats();
      res.status(200).json({ success: true, data: stats });
    } catch (err) {
      next(err);
    }
  }

  static async getUsers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, search, role, isActive, tier } = req.query;
      const result = await AdminService.getAllUsers({
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        search: search as string,
        role: role as any,
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
        tier: tier as any,
      });
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async createUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user!.userId;
      const { fullName, username, email, password, role, phoneNumber, tier } = req.body;
      if (!fullName || !username || !email || !password) {
        res.status(400).json({ success: false, message: 'fullName, username, email, and password are required.' });
        return;
      }
      const user = await AdminService.createUser(
        { fullName, username, email, password, role, phoneNumber, tier },
        adminId
      );
      res.status(201).json({
        success: true,
        message: `Account @${user.username} successfully created.`,
        data: user,
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateUserStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      const adminId = req.user!.userId;

      if (typeof isActive !== 'boolean') {
        res.status(400).json({ success: false, message: 'isActive (boolean) is required.' });
        return;
      }

      const result = await AdminService.updateUserStatus(id, isActive, adminId);
      res.status(200).json({
        success: true,
        message: `User ${result.username} is now ${isActive ? 'active' : 'suspended'}.`,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateUserRole(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { role } = req.body;
      const adminId = req.user!.userId;

      if (!['ADMIN', 'MEMBER'].includes(role)) {
        res.status(400).json({ success: false, message: "role must be either 'ADMIN' or 'MEMBER'." });
        return;
      }

      const result = await AdminService.updateUserRole(id, role, adminId);
      res.status(200).json({
        success: true,
        message: `User ${result.username} role updated to ${role}.`,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async deleteUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const adminId = req.user!.userId;
      const result = await AdminService.deleteUser(id, adminId);
      res.status(200).json({ success: true, message: result.message });
    } catch (err) {
      next(err);
    }
  }

  static async manageUserLicense(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const adminId = req.user!.userId;
      const result = await AdminService.manageUserLicense(id, req.body, adminId);
      res.status(200).json({
        success: true,
        message: 'User license successfully updated.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async generateLicenseKeys(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user!.userId;
      const result = await AdminService.generateLicenseKeys(req.body, adminId);
      res.status(201).json({
        success: true,
        message: `Generated ${result.count} license keys.`,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getLicenseKeys(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const keys = await AdminService.getAllLicenseKeys();
      res.status(200).json({ success: true, data: keys });
    } catch (err) {
      next(err);
    }
  }

  static async revokeLicenseKey(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const result = await AdminService.revokeLicenseKey(id);
      res.status(200).json({ success: true, message: result.message });
    } catch (err) {
      next(err);
    }
  }

  static async getCalls(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit } = req.query;
      const result = await AdminService.getCallAuditLogs({
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async broadcastMessage(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { title, message, priority = 'NORMAL' } = req.body;
      if (!title || !message) {
        res.status(400).json({ success: false, message: 'title and message are required.' });
        return;
      }

      const io = getSocketServer();
      const recipientsCount = io?.engine?.clientsCount || 0;

      if (io) {
        io.emit('system:announcement', {
          id: Date.now().toString(),
          title,
          message,
          priority,
          sentBy: req.user!.username,
          timestamp: new Date().toISOString(),
        });
      }

      const entry = AdminService.recordBroadcast({
        title,
        message,
        priority: priority as any,
        sentBy: req.user!.username,
        recipientsCount,
      });

      res.status(200).json({
        success: true,
        message: 'System announcement broadcast successfully to all connected users.',
        data: entry,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getBroadcasts(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const history = AdminService.getBroadcastHistory();
      res.status(200).json({ success: true, data: history });
    } catch (err) {
      next(err);
    }
  }

  static async getAuditLogs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { limit, search } = req.query;
      const logs = AdminService.getAuditLogs({
        limit: limit ? Number(limit) : undefined,
        search: search as string,
      });
      res.status(200).json({ success: true, data: logs });
    } catch (err) {
      next(err);
    }
  }

  static async getAppConfig(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const config = AdminService.getAppConfig();
      res.status(200).json({ success: true, data: config });
    } catch (err) {
      next(err);
    }
  }

  static async updateAppConfig(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const updated = AdminService.updateAppConfig(req.body, req.user!.username);
      res.status(200).json({
        success: true,
        message: 'Application configuration updated successfully.',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  static async resetUserPassword(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;
      if (!newPassword || newPassword.length < 6) {
        res.status(400).json({ success: false, message: 'newPassword (minimum 6 characters) is required.' });
        return;
      }
      const result = await AdminService.resetUserPassword(id, newPassword, req.user!.username);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async revokeUserSessions(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const result = await AdminService.revokeUserSessions(id, req.user!.username);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getContacts(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await AdminService.getContactsOverview();
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async getMessages(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await AdminService.getMessagesOverview();
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async getInfrastructure(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const io = getSocketServer();
      const connectedCount = io?.engine?.clientsCount || 0;
      const data = await AdminService.getInfrastructureTelemetry(connectedCount);
      res.status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async getSupportTickets(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tickets = AdminService.getSupportTickets();
      res.status(200).json({ success: true, data: tickets });
    } catch (err) {
      next(err);
    }
  }

  static async createSupportTicket(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const ticket = AdminService.createSupportTicket(req.body);
      res.status(201).json({ success: true, data: ticket });
    } catch (err) {
      next(err);
    }
  }

  static async resolveSupportTicket(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { resolution } = req.body;
      const ticket = AdminService.resolveSupportTicket(id, resolution || 'Resolved by administrator.', req.user!.username);
      res.status(200).json({ success: true, data: ticket });
    } catch (err) {
      next(err);
    }
  }

  static async getBackups(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const backups = AdminService.getBackups();
      res.status(200).json({ success: true, data: backups });
    } catch (err) {
      next(err);
    }
  }

  static async createBackup(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const backup = await AdminService.createBackupSnapshot(req.user!.username);
      res.status(201).json({ success: true, message: 'Database backup snapshot generated.', data: backup });
    } catch (err) {
      next(err);
    }
  }
}
