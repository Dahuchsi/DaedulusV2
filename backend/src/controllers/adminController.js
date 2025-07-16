const { User, Download, Request, Message } = require('../models');
const sequelize = require('../config/database'); // Keep for transactions
const { Op } = require('sequelize');

const adminController = {
    async getStats(req, res) {
        try {
            const totalUsers = await User.count({ where: { is_admin: false } });
            const activeUsers = await User.count({
                where: {
                    is_admin: false,
                    updated_at: {
                        [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
                    }
                }
            });
            const totalDownloads = await Download.count();
            const pendingRequests = await Request.count({ where: { status: 'pending' } });

            res.json({
                total_users: totalUsers,
                active_users: activeUsers,
                total_downloads: totalDownloads,
                pending_requests: pendingRequests
            });
        } catch (error) {
            console.error('Get stats error:', error);
            res.status(500).json({ error: 'Failed to fetch stats' });
        }
    },

    async getAllDownloads(req, res) {
        try {
            const { limit = 100, offset = 0 } = req.query;
            const downloads = await Download.findAll({
                include: [{
                    model: User,
                    attributes: ['id', 'username', 'email']
                }],
                order: [['created_at', 'DESC']],
                limit: parseInt(limit),
                offset: parseInt(offset)
            });

            const formattedDownloads = downloads.map(download => ({
                ...download.toJSON(),
                username: download.User?.username || 'Unknown'
            }));

            res.json(formattedDownloads);
        } catch (error) {
            console.error('Get all downloads error:', error);
            res.status(500).json({ error: 'Failed to fetch downloads' });
        }
    },

    async getUsers(req, res) {
        try {
            const users = await User.findAll({
                where: { is_admin: false },
                attributes: { exclude: ['password_hash'] },
                order: [['created_at', 'DESC']]
            });

            res.json(users);
        } catch (error) {
            console.error('Get users error:', error);
            res.status(500).json({ error: 'Failed to fetch users' });
        }
    },

    async getRequests(req, res) {
        try {
            const requests = await Request.findAll({
                include: [{
                    model: User,
                    attributes: ['id', 'username', 'email']
                }],
                order: [['created_at', 'DESC']]
            });

            const formattedRequests = requests.map(request => ({
                ...request.toJSON(),
                username: request.User?.username || 'Unknown'
            }));

            res.json(formattedRequests);
        } catch (error) {
            console.error('Get requests error:', error);
            res.status(500).json({ error: 'Failed to fetch requests' });
        }
    },

    async updateRequest(req, res) {
        try {
            const { id } = req.params;
            const { status } = req.body;

            if (!['fulfilled', 'rejected'].includes(status)) {
                return res.status(400).json({ error: 'Invalid status' });
            }

            const request = await Request.findByPk(id);

            if (!request) {
                return res.status(404).json({ error: 'Request not found' });
            }

            await request.update({ status });

            // Send message to user about request status
            const message = status === 'fulfilled'
                ? `Your request for "${request.search_query}" has been fulfilled!`
                : `Your request for "${request.search_query}" has been rejected.`;

            await Message.create({
                sender_id: req.user.id,
                recipient_id: request.user_id,
                content: message,
                message_type: 'text'
            });

            res.json(request);
        } catch (error) {
            console.error('Update request error:', error);
            res.status(500).json({ error: 'Failed to update request' });
        }
    },

    async broadcastMessage(req, res) {
        try {
            const { message } = req.body;

            if (!message || !message.trim()) {
                return res.status(400).json({ error: 'Message is required' });
            }

            // Get all non-admin users
            const users = await User.findAll({
                where: { is_admin: false },
                attributes: ['id']
            });

            // Create messages for all users
            const messages = users.map(user => ({
                sender_id: req.user.id,
                recipient_id: user.id,
                content: message.trim(),
                message_type: 'text'
            }));

            await Message.bulkCreate(messages);

            // Emit socket event to all users
            const io = req.app.get('io');
            io.emit('broadcast:message', {
                from: 'Dahuchsi',
                content: message.trim()
            });

            res.json({
                message: 'Broadcast sent successfully',
                recipients: users.length
            });
        } catch (error) {
            console.error('Broadcast message error:', error);
            res.status(500).json({ error: 'Failed to broadcast message' });
        }
    },

    async deleteUser(req, res) {
        try {
            const { id } = req.params;

            // Find the user to delete
            const user = await User.findOne({
                where: {
                    id,
                    is_admin: false // Prevent deleting admin accounts
                }
            });

            if (!user) {
                return res.status(404).json({ error: 'User not found or cannot delete admin users' });
            }

            const username = user.username;

            // Use a transaction to ensure all related data is deleted properly
            await sequelize.transaction(async (t) => {
                // Delete user's downloads
                await Download.destroy({
                    where: { user_id: id },
                    transaction: t
                });

                // Delete user's messages (both sent and received)
                await Message.destroy({
                    where: {
                        [Op.or]: [
                            { sender_id: id },
                            { recipient_id: id }
                        ]
                    },
                    transaction: t
                });

                // Delete user's requests
                await Request.destroy({
                    where: { user_id: id },
                    transaction: t
                });

                // Finally delete the user
                await user.destroy({ transaction: t });
            });

            console.log(`Admin ${req.user.username} deleted user: ${username} (ID: ${id})`);

            res.json({
                message: `User "${username}" and all associated data deleted successfully`
            });
        } catch (error) {
            console.error('Delete user error:', error);
            res.status(500).json({ error: 'Failed to delete user' });
        }
    }
};

module.exports = adminController;