const { User, Download, Request, SearchLog, MessageLog, Message } = require('../models'); // Import new models (SearchLog, MessageLog) and Message
const { Op } = require('sequelize'); // Import Op for Sequelize operators
const { hashPassword } = require('../utils/passwordUtils'); // Import password utility

const adminController = {
    async getStats(req, res) {
        try {
            // Count non-admin users for 'total_users'
            const totalUsers = await User.count({ where: { is_admin: false } });
            // 'Active users' logic: users who have updated their profile or had activity in last 7 days (example)
            const activeUsers = await User.count({
                where: {
                    is_admin: false, // Only non-admin users
                    updated_at: {
                        [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Users active in the last 7 days
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
            console.error('Failed to get admin stats:', error);
            res.status(500).json({ error: 'Failed to fetch stats' });
        }
    },

    async getAllDownloads(req, res) {
        try {
            const { limit = 100, offset = 0 } = req.query;
            const downloads = await Download.findAll({
                include: [{
                    model: User,
                    as: 'user', // Ensure this alias matches the association in Download model
                    attributes: ['id', 'username', 'email']
                }],
                order: [['created_at', 'DESC']],
                limit: parseInt(limit),
                offset: parseInt(offset)
            });

            // Format downloads to include username from associated User model
            const formattedDownloads = downloads.map(download => ({
                ...download.toJSON(), // Convert Sequelize instance to plain object
                username: download.user?.username || 'Unknown User' // Access username via the alias
            }));

            res.json(formattedDownloads);
        } catch (error) {
            console.error('Failed to get all downloads:', error);
            res.status(500).json({ error: 'Failed to fetch downloads' });
        }
    },

    async getUsers(req, res) {
        try {
            const users = await User.findAll({
                where: { is_admin: false }, // Exclude admin users from this list
                attributes: { exclude: ['password_hash'] }, // Never send password hashes
                order: [['created_at', 'ASC']] // Order by creation date
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

            // Find the user to delete, ensuring they are not an admin
            const user = await User.findOne({
                where: {
                    id,
                    is_admin: false // Prevent accidental deletion of admin accounts
                }
            });

            if (!user) {
                return res.status(404).json({ error: 'User not found or cannot delete admin users' });
            }

            const username = user.username;

            // Use a transaction to ensure all related data is deleted properly
            // This is crucial for maintaining data integrity when deleting a user
            await user.sequelize.transaction(async (t) => {
                // Delete user's downloads (if Download model has onDelete: 'CASCADE' this might not be needed explicitly)
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

                // Delete search logs associated with the user
                await SearchLog.destroy({
                    where: { user_id: id },
                    transaction: t
                });

                // Delete message logs associated with the user (sent or received)
                await MessageLog.destroy({
                    where: {
                        [Op.or]: [
                            { sender_id: id },
                            { recipient_id: id }
                        ]
                    },
                    transaction: t
                });

                // Finally, delete the user
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
    },

    async getRequests(req, res) {
        try {
            const requests = await Request.findAll({
                include: [{
                    model: User,
                    as: 'user', // Ensure this alias matches the association in Request model
                    attributes: ['id', 'username', 'email']
                }],
                order: [['created_at', 'DESC']]
            });

            // Format requests to include username from associated User model
            const formattedRequests = requests.map(request => ({
                ...request.toJSON(),
                username: request.user?.username || 'Unknown User'
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
            const messageContent = status === 'fulfilled'
                ? `Your request for "${request.search_query}" has been fulfilled!`
                : `Your request for "${request.search_query}" has been rejected.`;

            await Message.create({
                sender_id: req.user.id, // Admin's ID
                recipient_id: request.user_id, // User who made the request
                content: messageContent,
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

            // Get all non-admin users to send the broadcast to
            const users = await User.findAll({
                where: { is_admin: false },
                attributes: ['id']
            });

            // Prepare messages for bulk creation
            const messages = users.map(user => ({
                sender_id: req.user.id, // Admin's ID
                recipient_id: user.id,
                content: message.trim(),
                message_type: 'text'
            }));

            // Create all broadcast messages in the database
            await Message.bulkCreate(messages);

            // Emit socket event to all connected clients for real-time broadcast
            const io = req.app.get('io');
            // 'broadcast:message' should be a listener on the frontend
            io.emit('message:broadcast', {
                from: 'Dahuchsi (Admin)', // Clarify sender
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

    async changeUserPassword(req, res) {
        try {
            const { id } = req.params; // User ID whose password is being changed
            const { newPassword } = req.body; // The new password for the user

            // Basic password validation
            if (!newPassword || newPassword.length < 6) {
                return res.status(400).json({ error: 'New password must be at least 6 characters long' });
            }

            const user = await User.findByPk(id);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Ensure admin cannot change another admin's password (optional, but good practice)
            if (user.is_admin && user.id !== req.user.id) { // Allow admin to change their own password
                return res.status(403).json({ error: 'Cannot change another admin\'s password' });
            }

            // Hash the new password using the utility function
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
                order: [['search_date', 'DESC']], // Latest searches first
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
                // Find messages where the user is either sender or recipient
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