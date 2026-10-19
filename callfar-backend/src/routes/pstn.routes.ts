import { Router } from 'express';
import { PstnController } from '../controllers/pstn.controller.js';
import { requireAuth, requireAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

// Public / Authenticated helper routes
router.get('/countries', PstnController.getCountries);
router.get('/detect', PstnController.detectCarrier);

// Authenticated Calling Routes
router.use(requireAuth);
router.post('/call', PstnController.initiateCall);
router.post('/hangup', PstnController.endCall);
router.post('/dtmf', PstnController.sendDtmf);
router.get('/history', PstnController.getHistory);

// Admin Gateway & Telecom Management Routes
router.get('/admin/logs', requireAdmin, PstnController.getAdminLogs);
router.get('/admin/config', requireAdmin, PstnController.getGatewayConfig);
router.post('/admin/config', requireAdmin, PstnController.updateGatewayConfig);

export default router;
