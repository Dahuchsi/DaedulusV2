const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middleware/auth');

// All routes below require authentication
router.use(auth);

router.get('/me', userController.getProfile);
router.put('/me', userController.updateProfile);

// Avatar upload: multer is handled inside the controller!
router.post('/me/avatar', userController.uploadAvatar);

router.get('/me/watchlists', userController.getWatchlists);
router.post('/me/watchlists', userController.createWatchlist);
router.post('/me/watchlists/:watchlistId/items', userController.addToWatchlist);
router.delete('/me/watchlists/:watchlistId/items/:itemIndex', userController.removeFromWatchlist);

module.exports = router;