// src/middleware/auth.js

const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/constants');
const { User } = require('../models'); // Import from models index

// Auth middleware function
async function authMiddleware(req, res, next) {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);

        const user = await User.findByPk(decoded.id, {
            attributes: { exclude: ['password_hash'] }
        });

        if (!user) {
            return res.status(401).json({ error: 'Invalid authentication token' });
        }

        req.user = user;
        req.token = token;
        next();

    } catch (error) {
        res.status(401).json({ error: 'Invalid authentication token' });
    }
}

// Export the middleware function directly
module.exports = authMiddleware;