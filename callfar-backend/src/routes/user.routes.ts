import { Router } from 'express';
import { UserController } from '../controllers/user.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(requireAuth);

router.get('/profile', UserController.getProfile);
router.patch('/profile', UserController.updateProfile);
router.patch('/settings', UserController.updateSettings);
router.patch('/password', UserController.changePassword);
router.delete('/account', UserController.deleteAccount);
router.get('/search', UserController.searchUsers);

export default router;
