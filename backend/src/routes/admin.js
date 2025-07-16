const router = require('express').Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');

// Apply auth and admin middleware to all routes
router.use(authMiddleware);
router.use(adminMiddleware);

// Stats
router.get('/stats', adminController.getStats);

// Downloads
router.get('/downloads', adminController.getAllDownloads);

// Users
router.get('/users', adminController.getUsers);
router.delete('/users/:id', adminController.deleteUser);

// Requests
router.get('/requests', adminController.getRequests);
router.put('/requests/:id', adminController.updateRequest);

// Broadcast
router.post('/broadcast', adminController.broadcastMessage);

module.exports = router;