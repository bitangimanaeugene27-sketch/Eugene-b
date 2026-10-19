import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller.js';
import { requireAuth, requireAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

// Enforce authentication & administrator privilege on all routes
router.use(requireAuth);
router.use(requireAdmin);

// System Health & Analytics
router.get('/stats', AdminController.getStats);

// User Management & Actions
router.get('/users', AdminController.getUsers);
router.post('/users', AdminController.createUser);
router.patch('/users/:id/status', AdminController.updateUserStatus);
router.patch('/users/:id/role', AdminController.updateUserRole);
router.delete('/users/:id', AdminController.deleteUser);
router.put('/users/:id/license', AdminController.manageUserLicense);
router.post('/users/:id/reset-password', AdminController.resetUserPassword);
router.post('/users/:id/revoke-sessions', AdminController.revokeUserSessions);

// License Key Generation & Management
router.get('/licenses/keys', AdminController.getLicenseKeys);
router.post('/licenses/keys', AdminController.generateLicenseKeys);
router.delete('/licenses/keys/:id', AdminController.revokeLicenseKey);

// Call Audit & System Broadcast
router.get('/calls', AdminController.getCalls);
router.post('/broadcast', AdminController.broadcastMessage);
router.get('/broadcasts', AdminController.getBroadcasts);

// System Configuration & Settings
router.get('/config', AdminController.getAppConfig);
router.put('/config', AdminController.updateAppConfig);

// Security Audit Logs
router.get('/audit-logs', AdminController.getAuditLogs);

// Real-Time Infrastructure & Health
router.get('/infrastructure', AdminController.getInfrastructure);

// Contacts & Network Graph
router.get('/contacts', AdminController.getContacts);

// Messages & Conversations Metrics
router.get('/messages', AdminController.getMessages);

// Customer Support & Feedback Tickets
router.get('/support-tickets', AdminController.getSupportTickets);
router.post('/support-tickets', AdminController.createSupportTicket);
router.post('/support-tickets/:id/resolve', AdminController.resolveSupportTicket);

// Database Backups & Snapshots
router.get('/backups', AdminController.getBackups);
router.post('/backups/create', AdminController.createBackup);

export default router;
