const torrentSearchService = require('../services/torrentSearchService');
const { SearchLog, User } = require('../models'); // Import SearchLog and User model

const searchController = {
    async search(req, res, next) {
        const { query, sortBy = 'seeders' } = req.query;
        const userId = req.user ? req.user.id : null;
        let username = 'Guest'; // Default for unauthenticated users
        let searchStatus = 'error'; // Default status
        let resultCount = 0;

        try {
            if (!query) {
                searchStatus = 'invalid_query';
                // Try to get username for logging even if query is invalid
                if (userId) {
                    const user = await User.findByPk(userId, { attributes: ['username'] });
                    username = user ? user.username : 'Unknown User';
                }
                // Log the search before returning error
                await SearchLog.create({
                    user_id: userId,
                    username: username,
                    query: query || '', // Log empty string if query is null/undefined
                    status: searchStatus,
                    result_count: 0
                });
                return res.status(400).json({ error: 'Search query is required' });
            }

            // Get username for logging if authenticated and not already set
            if (userId && username === 'Guest') {
                const user = await User.findByPk(userId, { attributes: ['username'] });
                username = user ? user.username : 'Unknown User';
            }

            const results = await torrentSearchService.search(query, sortBy);

            searchStatus = results && results.length > 0 ? 'success' : 'no_results';
            resultCount = results ? results.length : 0;

            res.json(results);

        } catch (error) {
            console.error('Search controller error:', error);
            searchStatus = 'error';
            // Ensure username is set even if error occurs early
            if (userId && username === 'Guest') {
                 const user = await User.findByPk(userId, { attributes: ['username'] });
                 username = user ? user.username : 'Unknown User';
            }
            next(error); // Pass error to express error handler
        } finally {
            // Ensure logging happens after response or error handling for authenticated users
            if (userId) { // Only log if a user ID is available
                try {
                    await SearchLog.create({
                        user_id: userId,
                        username: username,
                        query: query || '',
                        status: searchStatus,
                        result_count: resultCount
                    });
                } catch (logError) {
                    console.error('Failed to log search:', logError.message);
                }
            }
        }
    },

    async getMagnetLink(req, res, next) {
        try {
            const { torrent } = req.body; // Expect the full torrent object

            if (!torrent) {
                return res.status(400).json({ error: 'Torrent object is required' });
            }

            const magnetLink = await torrentSearchService.getMagnet(torrent);

            if (!magnetLink) {
                return res.status(404).json({ error: 'Magnet link could not be retrieved.' });
            }

            res.json({ magnetLink });

        } catch (error) {
            console.error('Get magnet link error:', error);
            next(error);
        }
    }
};

module.exports = searchController;