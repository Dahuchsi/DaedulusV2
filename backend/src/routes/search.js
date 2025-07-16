const router = require('express').Router();
const searchController = require('../controllers/searchController');
const authMiddleware = require('../middleware/auth');
const fs = require('fs');
const path = require('path');

console.log('searchController:', searchController);
console.log('searchController.search:', searchController.search);
console.log('typeof searchController.search:', typeof searchController.search);
console.log('authMiddleware:', authMiddleware);
console.log('typeof authMiddleware:', typeof authMiddleware);

router.get('/', authMiddleware, searchController.search);
router.post('/magnet', authMiddleware, searchController.getMagnetLink);

// --- New: Log search endpoint ---
router.post('/log-search', authMiddleware, (req, res) => {
    const { username, query } = req.body;
    if (!username || !query) {
        return res.status(400).json({ error: 'Missing username or query' });
    }
    const logLine = `[${new Date().toISOString()}] ${username}: ${query}\n`;
    const logDir = 'C:/Projects/Daedulus/backend/logs';
    const logFile = path.join(logDir, 'search_logs.txt');
    try {
        fs.mkdirSync(logDir, { recursive: true });
        fs.appendFileSync(logFile, logLine, 'utf8');
        res.json({ success: true });
    } catch (err) {
        console.error('Failed to write search log:', err);
        res.status(500).json({ error: 'Failed to write log' });
    }
});

module.exports = router;