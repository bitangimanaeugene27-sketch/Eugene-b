import { Router } from 'express';
import { MessageController } from '../controllers/message.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(requireAuth);

router.get('/conversations', MessageController.getConversations);
router.post('/conversations/direct', MessageController.getOrCreateDirectConversation);
router.get('/conversations/:conversationId/messages', MessageController.getMessages);
router.post('/conversations/:conversationId/messages', MessageController.sendMessage);
router.post('/conversations/:conversationId/read', MessageController.markRead);

export default router;
