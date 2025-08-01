const { User, Download, Request, SearchLog, MessageLog } = require('../models');
const { Op } = require('sequelize');
const { hashPassword } = require('../utils/passwordUtils'); // Import password utility

const adminController = {
    async getStats(req, res) {
        try {
            const totalUsers = await User.count();
            const activeUsers = await User.count(); // Placeholder for actual active user logic

            const totalDownloads = await Download.count();
            const pendingRequests = await Request.count({ where: { status: 'pending' } });

            res.json({
                total_users: totalUsers,
                active_users: activeUsers,
                total_downloads: totalDownloads,
                pending_requests: pendingRequests
            });
        } catch (error) {
            console.error('Failed to get admin stats:', error);
            res.status(500).json({ error: 'Failed to fetch stats' });
        }
    },

    async getAllDownloads(req, res) {
        try {
            const downloads = await Download.findAll({
                include: [{ model: User, as: 'user', attributes: ['username'] }],
                order: [['created_at', 'DESC']]
            });
            res.json(downloads);
        } catch (error) {
            console.error('Failed to get all downloads:', error);
            res.status(500).json({ error: 'Failed to fetch all downloads' });
        }
    },

    async getUsers(req, res) {
        try {
            const users = await User.findAll({
                attributes: { exclude: ['password_hash'] },
                order: [['created_at', 'ASC']]
            });
            res.json(users);
        } catch (error) {
            console.error('Failed to get users:', error);
            res.status(500).json({ error: 'Failed to fetch users' });
        }
    },

    async deleteUser(req, res) {
        try {
            const { id } = req.params;
            const user = await User.findByPk(id);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            await user.destroy();
            res.json({ message: 'User deleted successfully' });
        } catch (error) {
            console.error('Failed to delete user:', error);
            res.status(500).json({ error: 'Failed to delete user' });
        }
    },

    async updateRequest(req, res) {
        try {
            const { id } = req.params;
            const { status } = req.body;
            const request = await Request.findByPk(id);
            if (!request) {
                return res.status(404).json({ error: 'Request not found' });
            }
            await request.update({ status });
            res.json(request);
        } catch (error) {
            console.error('Failed to update request:', error);
            res.status(500).json({ error: 'Failed to update request' });
        }
    },

    async broadcastMessage(req, res) {
        const io = req.app.get('io');
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Broadcast message content is required' });
        }

        io.emit('message:broadcast', { from: 'Admin', content: message });
        res.json({ message: 'Message broadcasted successfully (to connected clients)' });
    },

    async changeUserPassword(req, res) {
        try {
            const { id } = req.params; // User ID whose password is being changed
            const { newPassword } = req.body; // The new password for the user

            if (!newPassword || newPassword.length < 6) { // Basic validation
                return res.status(400).json({ error: 'New password must be at least 6 characters long' });
            }

            const user = await User.findByPk(id);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Hash the new password
            const hashedPassword = await hashPassword(newPassword);

            // Update the user's password hash in the database
            await user.update({ password_hash: hashedPassword });

            res.json({ message: `Password for user "${user.username}" changed successfully.` });

        } catch (error) {
            console.error('Admin change user password error:', error);
            res.status(500).json({ error: 'Failed to change user password' });
        }
    },

    async getSearchLogs(req, res) {
        try {
            const { userId } = req.query; // Optional: filter by user
            const whereClause = {};
            if (userId) {
                whereClause.user_id = userId;
            }

            const searchLogs = await SearchLog.findAll({
                where: whereClause,
                order: [['search_date', 'DESC']],
                include: [{ model: User, as: 'user', attributes: ['username', 'avatar_url'] }] // Include user info
            });
            res.json(searchLogs);
        } catch (error) {
            console.error('Failed to fetch search logs:', error);
            res.status(500).json({ error: 'Failed to fetch search logs' });
        }
    },

    async getMessageLogs(req, res) {
        try {
            const { userId } = req.query; // Optional: filter by user
            const whereClause = {};
            if (userId) {
                whereClause[Op.or] = [
                    { sender_id: userId },
                    { recipient_id: userId }
                ];
            }

            const messageLogs = await MessageLog.findAll({
                where: whereClause,
                order: [['sent_at', 'ASC']], // Ascending order for conversational flow
            });
            res.json(messageLogs);
        } catch (error) {
            console.error('Failed to fetch message logs:', error);
            res.status(500).json({ error: 'Failed to fetch message logs' });
        }
    }
};

module.exports = adminController;