import { Router } from 'express';
import { CallController } from '../controllers/call.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(requireAuth);

router.get('/ice-servers', CallController.getIceServers);
router.post('/initiate', CallController.initiateCall);
router.get('/history', CallController.getHistory);

export default router;
