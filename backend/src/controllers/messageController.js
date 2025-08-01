const { Message, User, Friendship, MessageLog } = require('../models'); // Import MessageLog
const { Op } = require('sequelize');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Configure multer for file uploads in messages
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../../uploads/messages');
        try {
            await fs.mkdir(uploadPath, { recursive: true });
            cb(null, uploadPath);
        } catch (error) {
            console.error('Failed to create upload directory:', error);
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(file.originalname).toLowerCase();
        cb(null, `message-file-${uniqueSuffix}${extension}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        // Allow images, videos, documents
        const allowedTypes = /jpeg|jpg|png|gif|webp|mp4|mov|avi|pdf|doc|docx|txt|zip|rar/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype) || file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/');

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image, video, and document files are allowed'));
        }
    }
}).single('file');

// --- Controller functions ---

async function getConversations(req, res) {
    try {
        // Get all friendships
        const friendships = await Friendship.findAll({
            where: {
                user_id: req.user.id,
                status: 'accepted'
            },
            include: [{
                model: User,
                as: 'friend',
                attributes: ['id', 'username', 'avatar_url']
            }]
        });

        // Get last message and unread count for each conversation
        const conversations = await Promise.all(friendships.map(async (friendship) => {
            const lastMessage = await Message.findOne({
                where: {
                    [Op.or]: [
                        { sender_id: req.user.id, recipient_id: friendship.friend_id },
                        { sender_id: friendship.friend_id, recipient_id: req.user.id }
                    ]
                },
                order: [['created_at', 'DESC']]
            });

            const unreadCount = await Message.count({
                where: {
                    sender_id: friendship.friend_id,
                    recipient_id: req.user.id,
                    is_read: false
                }
            });

            return {
                friend_id: friendship.friend.id,
                friend_username: friendship.friend.username,
                friend_avatar: friendship.friend.avatar_url,
                last_message: lastMessage,
                unread_count: unreadCount
            };
        }));

        res.json(conversations);

    } catch (error) {
        console.error('Get conversations error:', error);
        res.status(500).json({ error: 'Failed to fetch conversations' });
    }
}

async function getMessages(req, res) {
    try {
        const { friendId } = req.params;
        const { limit = 50, offset = 0 } = req.query;

        // Verify friendship exists
        const friendship = await Friendship.findOne({
            where: {
                user_id: req.user.id,
                friend_id: friendId,
                status: 'accepted'
            }
        });

        if (!friendship) {
            return res.status(403).json({ error: 'Not authorized to view these messages' });
        }

        const messages = await Message.findAll({
            where: {
                [Op.or]: [
                    { sender_id: req.user.id, recipient_id: friendId },
                    { sender_id: friendId, recipient_id: req.user.id }
                ]
            },
            include: [{
                model: User,
                as: 'sender',
                attributes: ['id', 'username', 'avatar_url']
            }],
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json(messages.reverse());

    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
}

async function sendMessage(req, res) {
    const { recipient_id, content, message_type = 'text' } = req.body;
    const senderId = req.user.id; // Sender is the authenticated user

    try {
        if (!content || !content.trim()) {
            return res.status(400).json({ error: 'Message content is required' });
        }

        // Verify friendship exists
        const friendship = await Friendship.findOne({
            where: {
                user_id: senderId,
                friend_id: recipient_id,
                status: 'accepted'
            }
        });

        if (!friendship) {
            return res.status(403).json({ error: 'You can only message friends' });
        }

        // Detect if content is a URL for link messages
        const urlRegex = /^https?:\/\/[^\s]+$/;
        const actualMessageType = urlRegex.test(content.trim()) ? 'link' : message_type;

        const message = await Message.create({
            sender_id: senderId,
            recipient_id,
            content: content.trim(),
            message_type: actualMessageType
        });

        const messageWithSender = await Message.findByPk(message.id, {
            include: [{
                model: User,
                as: 'sender',
                attributes: ['id', 'username', 'avatar_url']
            }]
        });

        // Log the message
        const senderUser = await User.findByPk(senderId, { attributes: ['username'] });
        const recipientUser = await User.findByPk(recipient_id, { attributes: ['username'] });

        if (senderUser && recipientUser) {
            await MessageLog.create({
                sender_id: senderId,
                sender_username: senderUser.username,
                recipient_id: recipient_id,
                recipient_username: recipientUser.username,
                message_content: content.trim(),
                message_type: actualMessageType
            });
        } else {
            console.warn('Failed to log message: Sender or recipient user not found.');
        }


        // Emit socket event
        const io = req.app.get('io');
        io.to(`user_${recipient_id}`).emit('message:new', messageWithSender);

        res.status(201).json(messageWithSender);

    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
}

function uploadFile(req, res) {
    upload(req, res, async (err) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({
                error: err.code === 'LIMIT_FILE_SIZE'
                    ? 'File size too large (max 10MB)'
                    : err.message
            });
        } else if (err) {
            return res.status(400).json({ error: err.message });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { recipient_id, text } = req.body;
        const senderId = req.user.id; // Sender is the authenticated user

        if (!recipient_id) {
            return res.status(400).json({ error: 'Recipient ID is required' });
        }

        try {
            // Verify friendship exists
            const friendship = await Friendship.findOne({
                where: {
                    user_id: senderId,
                    friend_id: recipient_id,
                    status: 'accepted'
                }
            });

            if (!friendship) {
                // Clean up uploaded file
                try {
                    await fs.unlink(req.file.path);
                } catch (cleanupError) {
                    console.error('Failed to clean up file:', cleanupError);
                }
                return res.status(403).json({ error: 'You can only send files to friends' });
            }

            // Create file URL
            const fileUrl = `/uploads/messages/${req.file.filename}`;

            // Determine message type based on file type
            let messageType = 'file';
            if (req.file.mimetype.startsWith('image/')) {
                messageType = 'image';
            } else if (req.file.mimetype.startsWith('video/')) {
                messageType = 'file'; // We'll treat videos as files for now
            }

            // Create message with file URL and optional text
            const message = await Message.create({
                sender_id: senderId,
                recipient_id: recipient_id,
                content: fileUrl,
                message_type: messageType,
                text: text || null
            });

            const messageWithSender = await Message.findByPk(message.id, {
                include: [{
                    model: User,
                    as: 'sender',
                    attributes: ['id', 'username', 'avatar_url']
                }]
            });

            // Log the file message
            const senderUser = await User.findByPk(senderId, { attributes: ['username'] });
            const recipientUser = await User.findByPk(recipient_id, { attributes: ['username'] });

            if (senderUser && recipientUser) {
                await MessageLog.create({
                    sender_id: senderId,
                    sender_username: senderUser.username,
                    recipient_id: recipient_id,
                    recipient_username: recipientUser.username,
                    message_content: fileUrl, // Log the URL as content
                    message_type: messageType,
                    // text field from original message is logged in content, or could add a separate log_text field
                });
            } else {
                console.warn('Failed to log file message: Sender or recipient user not found.');
            }

            // Emit socket event
            const io = req.app.get('io');
            io.to(`user_${recipient_id}`).emit('message:new', messageWithSender);

            res.status(201).json({
                message: messageWithSender,
                file_url: fileUrl
            });

        } catch (error) {
            // Clean up uploaded file if database operation fails
            try {
                await fs.unlink(req.file.path);
            } catch (cleanupError) {
                console.error('Failed to clean up uploaded file:', cleanupError);
            }
            res.status(500).json({ error: 'Failed to save file message' });
        }
    });
}

async function markAsRead(req, res) {
    try {
        const { friendId } = req.params;
        const recipientId = req.user.id; // The user marking messages as read is the recipient

        // Find the messages that were sent by the friend and received by the current user, and are unread
        const unreadMessages = await Message.findAll({
            where: {
                sender_id: friendId,
                recipient_id: recipientId,
                is_read: false
            }
        });

        await Message.update(
            { is_read: true },
            {
                where: {
                    sender_id: friendId,
                    recipient_id: req.user.id,
                    is_read: false
                }
            }
        );

        // Emit socket event for each message that was marked as read
        const io = req.app.get('io');
        unreadMessages.forEach(message => {
            // Emit to the sender (friendId) that their message (message.id) has been read by recipientId
            io.to(`user_${message.sender_id}`).emit('message:read', {
                messageId: message.id,
                readerId: recipientId
            });
            console.log(`Emitted message:read for message ${message.id} to user ${message.sender_id}`);
        });

        res.json({ message: 'Messages marked as read' });

    } catch (error) {
        console.error('Mark as read error:', error);
        res.status(500).json({ error: 'Failed to mark messages as read' });
    }
}

// --- Export all handlers ---
module.exports = {
    getConversations,
    getMessages,
    sendMessage,
    uploadFile,
    markAsRead
};