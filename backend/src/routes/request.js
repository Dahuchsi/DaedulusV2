const router = require('express').Router();
const Request = require('../models/Request');
const authMiddleware = require('../middleware/auth');

router.post('/', authMiddleware, async (req, res, next) => {
    try {
        const { searchQuery, torrentInfo } = req.body;

        if (!searchQuery) {
            return res.status(400).json({ error: 'Search query is required' });
        }

        const newRequest = await Request.create({
            user_id: req.user.id,
            search_query: searchQuery,
            torrent_info: torrentInfo || {}
        });

        const io = req.app.get('io');
        io.to('admin_room').emit('request:new', {
            id: newRequest.id,
            username: req.user.username,
            search_query: searchQuery
        });

        res.status(201).json(newRequest);

    } catch (error) {
        next(error);
    }
});

module.exports = router;
