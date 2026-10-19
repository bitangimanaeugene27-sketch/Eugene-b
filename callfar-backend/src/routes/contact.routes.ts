import { Router } from 'express';
import { ContactController } from '../controllers/contact.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(requireAuth);

router.get('/', ContactController.getContacts);
router.post('/request', ContactController.sendRequest);
router.get('/requests', ContactController.getRequests);
router.post('/requests/:requestId/accept', ContactController.acceptRequest);
router.post('/requests/:requestId/reject', ContactController.rejectRequest);
router.delete('/:contactUserId', ContactController.removeContact);

router.get('/blocked', ContactController.getBlockedUsers);
router.post('/block', ContactController.blockUser);
router.delete('/blocked/:blockedId', ContactController.unblockUser);

export default router;
