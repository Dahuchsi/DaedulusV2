const trendingService = require('../services/trendingService');

const trendingController = {
    getServices(req, res) {
        try {
            const services = trendingService.getServices();
            res.json(services);
        } catch (error) {
            console.error('Error fetching services:', error.message);
            res.status(500).json({ error: 'Failed to fetch services' });
        }
    },

    async getServiceContent(req, res) {
        try {
            const { serviceId } = req.params;
            const { page } = req.query;
            const content = await trendingService.getServiceContent(serviceId, page);
            res.json(content);
        } catch (error) {
            console.error('Error fetching trending content:', error.message);
            res.status(500).json({ error: 'Failed to fetch trending content' });
        }
    }
};

module.exports = trendingController;
