const express = require('express');
const router = express.Router();
const trendingController = require('../controllers/trendingController');
const { authenticateToken } = require('../middleware/auth');

router.get('/services', authenticateToken, trendingController.getServices);
router.get('/:serviceId', authenticateToken, trendingController.getServiceContent);

module.exports = router;
