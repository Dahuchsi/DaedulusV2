const router = require('express').Router();
const downloadController = require('../controllers/downloadController');
const authMiddleware = require('../middleware/auth');

router.get('/', authMiddleware, downloadController.getDownloads);
router.post('/queue', authMiddleware, downloadController.queueDownload);
router.get('/:id', authMiddleware, downloadController.getDownloadStatus);
router.delete('/:id', authMiddleware, downloadController.deleteDownload);

// NEW: Retry and status check endpoints
router.post('/:id/retry', authMiddleware, downloadController.retryDownload);
router.post('/:id/check-status', authMiddleware, downloadController.checkAllDebridStatus);

module.exports = router;