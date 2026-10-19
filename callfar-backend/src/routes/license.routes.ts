import { Router } from 'express';
import { LicenseController } from '../controllers/license.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(requireAuth);

router.get('/my', LicenseController.getMyLicense);
router.post('/redeem', LicenseController.redeemKey);

export default router;
