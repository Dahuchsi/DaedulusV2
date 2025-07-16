const router = require('express').Router();
const messageController = require('../controllers/messageController');
const authMiddleware = require('../middleware/auth');

// All message routes require authentication
router.use(authMiddleware);

// Get conversations
router.get('/conversations', messageController.getConversations);

// Get messages for a specific conversation
router.get('/:friendId', messageController.getMessages);

// Send a text message
router.post('/', messageController.sendMessage);

// Upload file and send as message
router.post('/upload', messageController.uploadFile);

// TODO: Add markAsRead function to messageController if needed
router.put('/:friendId/read', messageController.markAsRead);

module.exports = router;