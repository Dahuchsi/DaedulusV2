const torrentSearchService = require('../services/torrentSearchService');

const searchController = {
    async search(req, res, next) {
        try {
            const { query, sortBy = 'seeders' } = req.query;
            
            if (!query) {
                return res.status(400).json({ error: 'Search query is required' });
            }
            
            const results = await torrentSearchService.search(query, sortBy);
            
            // Send the array of results directly
            res.json(results);
            
        } catch (error) {
            console.error('Search controller error:', error);
            // Pass the error to the final error handler in app.js
            next(error); 
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

console.log('searchController.search:', searchController.search);

module.exports = searchController;
